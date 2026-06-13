# accounts/services/llm_service.py
"""
Unified LLM Service — Routes text/chat completions to Claude, OpenAI, or Gemini.

Architecture:
    - Claude (Anthropic) is the DEFAULT provider for all text/chat AI workflows.
      The Claude API key is a global admin key (from settings/env), shared by all users.
    - OpenAI and Gemini are FALLBACK providers for text, and remain the primary
      providers for image generation, video, voice, and embeddings.

Usage:
    from accounts.services.llm_service import get_llm_service

    service = get_llm_service(request.user)
    result = service.chat_completion(
        messages=[
            {"role": "system", "content": "You are helpful."},
            {"role": "user", "content": "Hello!"},
        ],
        temperature=0.7,
        max_tokens=500,
    )
    if result.success:
        text = result.content
"""

import logging
import json
import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any

import requests as http_requests

logger = logging.getLogger(__name__)


# ── Model Mapping ──────────────────────────────────────────────────

OPENAI_TO_GEMINI = {
    'gpt-4o': 'gemini-2.0-flash',
    'gpt-4o-mini': 'gemini-2.0-flash-lite',
    'gpt-4-turbo': 'gemini-1.5-pro',
}

GEMINI_TO_OPENAI = {v: k for k, v in OPENAI_TO_GEMINI.items()}

OPENAI_TO_CLAUDE = {
    'gpt-4o': 'claude-sonnet-4-20250514',
    'gpt-4o-mini': 'claude-haiku-4-5-20251001',
    'gpt-4-turbo': 'claude-sonnet-4-20250514',
}

CLAUDE_TO_OPENAI = {v: k for k, v in OPENAI_TO_CLAUDE.items()}

GEMINI_TO_CLAUDE = {
    'gemini-2.0-flash': 'claude-sonnet-4-20250514',
    'gemini-2.0-flash-lite': 'claude-haiku-4-5-20251001',
    'gemini-1.5-pro': 'claude-sonnet-4-20250514',
}

CLAUDE_TO_GEMINI = {v: k for k, v in GEMINI_TO_CLAUDE.items()}


# ── Normalised Response ────────────────────────────────────────────

@dataclass
class LLMResponse:
    """Provider-agnostic response from any LLM."""
    success: bool
    content: str = ''
    model: str = ''
    provider: str = ''
    tokens_used: int = 0          # total = input + output (back-compat)
    input_tokens: int = 0         # exact prompt/input tokens from provider
    output_tokens: int = 0        # exact completion/output tokens from provider
    cache_read_tokens: int = 0    # cached input tokens (Claude prompt cache hits)
    cache_write_tokens: int = 0   # cache write tokens
    finish_reason: str = ''
    error: str = ''
    raw_response: Any = None
    thinking: str = ''  # Claude extended thinking output


# ── Robust JSON Extraction ─────────────────────────────────────────

_FENCE_RE = re.compile(r'```(?:json)?\s*(.*?)\s*```', re.DOTALL | re.IGNORECASE)


def _find_json_span(text: str) -> Optional[str]:
    """Return the first balanced {...} or [...] span in `text`, ignoring
    braces/brackets that appear inside JSON string literals. Returns None
    if no balanced span is found."""
    start = None
    open_ch = close_ch = ''
    for i, ch in enumerate(text):
        if ch in '{[':
            start = i
            open_ch = ch
            close_ch = '}' if ch == '{' else ']'
            break
    if start is None:
        return None

    depth = 0
    in_str = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def extract_json_object(text: str):
    """Parse JSON out of an LLM response that may be wrapped in prose and/or
    markdown code fences.

    Handles: pure JSON, ```json fenced blocks (anywhere in the text),
    prose before/after the JSON, and braces inside string values.

    Raises json.JSONDecodeError if no valid JSON can be recovered, so callers
    that already catch json.JSONDecodeError keep working unchanged.
    """
    if text is None:
        raise json.JSONDecodeError('empty AI response', '', 0)

    cleaned = text.strip()

    # 1. Direct parse (the happy path — response is already pure JSON).
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 2. Pull the contents of a ```/```json fence appearing anywhere.
    fence = _FENCE_RE.search(cleaned)
    if fence:
        candidate = fence.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            cleaned = candidate  # fall through to span scan on the fence body

    # 3. Locate a balanced JSON span within whatever's left.
    span = _find_json_span(cleaned)
    if span is not None:
        return json.loads(span)  # let a failure here surface as JSONDecodeError

    raise json.JSONDecodeError('no JSON object found in AI response', cleaned, 0)


# ── Message Order Helper ──────────────────────────────────────────

def _ensure_valid_claude_message_order(messages: List[Dict]) -> List[Dict]:
    """
    Ensure messages follow Anthropic's alternating user/assistant pattern.
    - Must start with 'user'
    - Consecutive messages with the same role are merged
    """
    if not messages:
        return [{'role': 'user', 'content': 'Hello'}]

    # Merge consecutive same-role messages
    merged = []
    for msg in messages:
        if merged and merged[-1]['role'] == msg['role']:
            prev_content = merged[-1]['content']
            new_content = msg['content']
            if isinstance(prev_content, str) and isinstance(new_content, str):
                merged[-1]['content'] = prev_content + '\n\n' + new_content
            elif isinstance(prev_content, list) and isinstance(new_content, list):
                merged[-1]['content'] = prev_content + new_content
            elif isinstance(prev_content, str) and isinstance(new_content, list):
                merged[-1]['content'] = [{'type': 'text', 'text': prev_content}] + new_content
            elif isinstance(prev_content, list) and isinstance(new_content, str):
                merged[-1]['content'] = prev_content + [{'type': 'text', 'text': new_content}]
        else:
            merged.append(msg.copy())

    # Ensure first message is 'user'
    if merged and merged[0]['role'] != 'user':
        merged.insert(0, {'role': 'user', 'content': 'Begin.'})

    return merged


# ── Unified Service ────────────────────────────────────────────────

class UnifiedLLMService:
    """
    Accepts OpenAI-format messages and routes to the user's preferred provider.
    Claude is the default for all text/chat workflows.
    Handles model mapping, message format conversion, JSON mode, and vision.
    """

    def __init__(
        self,
        openai_key: Optional[str] = None,
        gemini_key: Optional[str] = None,
        claude_key: Optional[str] = None,
        preferred_provider: str = 'claude',
        openai_model: str = 'gpt-4o-mini',
        gemini_model: str = 'gemini-2.0-flash',
        claude_model: str = 'claude-sonnet-4-20250514',
    ):
        self.openai_key = openai_key
        self.gemini_key = gemini_key
        self.claude_key = claude_key
        self.preferred_provider = preferred_provider
        self.openai_model = openai_model
        self.gemini_model = gemini_model
        self.claude_model = claude_model

    # ── Public API ─────────────────────────────────────────────────

    def chat_completion(
        self,
        messages: List[Dict],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
        response_format: Optional[Dict] = None,
        thinking_budget: int = 0,
        tools: Optional[List[Dict]] = None,
        **kwargs,
    ) -> LLMResponse:
        """
        Main entry point.  Accepts OpenAI-format messages list.

        Args:
            messages:  [{"role": "system"|"user"|"assistant", "content": str|list}]
            model:     Requested model (auto-mapped to active provider)
            temperature, max_tokens:  Generation parameters
            response_format:  {"type": "json_object"} to enable JSON mode
            thinking_budget:  Claude extended thinking budget (>= 1024 to enable)
            tools:     Anthropic-format tool specs (e.g. server tools like
                       web_search). Claude-only for now; ignored by other providers.
            **kwargs:  Extra provider-specific params forwarded to OpenAI only
        """
        provider = self._resolve_provider()
        if not provider:
            return LLMResponse(
                success=False,
                error='No AI API key configured. Please contact the administrator.',
            )

        resolved_model = self._resolve_model(provider, model)

        if provider == 'claude':
            return self._claude_completion(
                messages, resolved_model, temperature, max_tokens,
                response_format, thinking_budget, tools,
            )
        elif provider == 'openai':
            return self._openai_completion(
                messages, resolved_model, temperature, max_tokens,
                response_format, **kwargs,
            )
        return self._gemini_completion(
            messages, resolved_model, temperature, max_tokens,
            response_format,
        )

    # ── Provider Resolution ────────────────────────────────────────

    def _resolve_provider(self) -> Optional[str]:
        """Resolve provider with fallback chain. Claude is preferred default."""
        if self.preferred_provider == 'claude':
            if self.claude_key:
                return 'claude'
            if self.openai_key:
                logger.info('Claude key missing, falling back to OpenAI')
                return 'openai'
            if self.gemini_key:
                logger.info('Claude key missing, falling back to Gemini')
                return 'gemini'
        elif self.preferred_provider == 'gemini':
            if self.gemini_key:
                return 'gemini'
            if self.claude_key:
                logger.info('Gemini key missing, falling back to Claude')
                return 'claude'
            if self.openai_key:
                logger.info('Gemini key missing, falling back to OpenAI')
                return 'openai'
        else:  # openai
            if self.openai_key:
                return 'openai'
            if self.claude_key:
                logger.info('OpenAI key missing, falling back to Claude')
                return 'claude'
            if self.gemini_key:
                logger.info('OpenAI key missing, falling back to Gemini')
                return 'gemini'
        return None

    def _resolve_model(self, provider: str, requested: Optional[str] = None) -> str:
        if not requested:
            if provider == 'claude':
                return self.claude_model
            return self.gemini_model if provider == 'gemini' else self.openai_model

        if provider == 'claude':
            if requested.startswith('claude'):
                return requested
            return OPENAI_TO_CLAUDE.get(requested, GEMINI_TO_CLAUDE.get(requested, self.claude_model))
        elif provider == 'openai':
            if requested.startswith('gpt'):
                return requested
            return GEMINI_TO_OPENAI.get(requested, CLAUDE_TO_OPENAI.get(requested, self.openai_model))
        else:  # gemini
            if requested.startswith('gemini'):
                return requested
            return OPENAI_TO_GEMINI.get(requested, CLAUDE_TO_GEMINI.get(requested, self.gemini_model))

    # ── Claude (Anthropic SDK) ────────────────────────────────────

    def _claude_completion(self, messages, model, temperature, max_tokens,
                           response_format, thinking_budget=0, tools=None) -> LLMResponse:
        try:
            import anthropic
            import httpx as _httpx
            # Extended thinking requires an unbounded timeout — the SDK raises a
            # pre-flight error if the client has a finite timeout and thinking is on.
            if thinking_budget >= 1024:
                client = anthropic.Anthropic(
                    api_key=self.claude_key,
                    timeout=_httpx.Timeout(None),
                )
            else:
                client = anthropic.Anthropic(api_key=self.claude_key)

            # Convert OpenAI-format messages to Anthropic format
            system_text, claude_messages = self._to_claude_messages(messages)

            # Handle JSON mode: inject system instruction for Claude
            if response_format and response_format.get('type') == 'json_object':
                json_instruction = (
                    "\n\nIMPORTANT: You MUST respond with ONLY valid JSON. "
                    "No markdown code fences, no explanatory text, no comments. "
                    "Start your response with { or [ and end with } or ]."
                )
                if system_text:
                    system_text += json_instruction
                else:
                    system_text = json_instruction.strip()

            params: Dict[str, Any] = {
                'model': model,
                'messages': claude_messages,
                'max_tokens': max_tokens,
            }

            # Extended thinking: when budget >= 1024, enable thinking mode
            if thinking_budget >= 1024:
                params['thinking'] = {'type': 'adaptive'}
                if thinking_budget >= 10000:
                    params['output_config'] = {'effort': 'high'}
                elif thinking_budget >= 3000:
                    params['output_config'] = {'effort': 'medium'}
                else:
                    params['output_config'] = {'effort': 'low'}
                # Also ensure max_tokens > thinking_budget
                if max_tokens <= thinking_budget:
                    params['max_tokens'] = thinking_budget + max_tokens
            else:
                params['temperature'] = temperature

            if system_text:
                params['system'] = system_text

            if tools:
                params['tools'] = tools

            resp = client.messages.create(**params)

            # Extract text and thinking content from response
            content = ''
            thinking_text = ''
            for block in resp.content:
                if hasattr(block, 'thinking'):
                    thinking_text += block.thinking
                elif hasattr(block, 'text'):
                    content += block.text

            # Strip markdown code fences if present (especially for JSON responses)
            content = content.strip()
            if content.startswith('```'):
                content = content.split('\n', 1)[1] if '\n' in content else content[3:]
                if content.endswith('```'):
                    content = content[:-3]
                content = content.strip()

            # Exact token usage (Anthropic returns input/output separately)
            input_tokens = 0
            output_tokens = 0
            cache_read = 0
            cache_write = 0
            if resp.usage:
                input_tokens = getattr(resp.usage, 'input_tokens', 0) or 0
                output_tokens = getattr(resp.usage, 'output_tokens', 0) or 0
                cache_read = getattr(resp.usage, 'cache_read_input_tokens', 0) or 0
                cache_write = getattr(resp.usage, 'cache_creation_input_tokens', 0) or 0
            tokens_used = input_tokens + output_tokens

            return LLMResponse(
                success=True,
                content=content,
                model=resp.model,
                provider='claude',
                tokens_used=tokens_used,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_read_tokens=cache_read,
                cache_write_tokens=cache_write,
                finish_reason=resp.stop_reason or '',
                raw_response=resp,
                thinking=thinking_text,
            )
        except Exception as e:
            logger.error('Claude completion failed: %s', e)
            return LLMResponse(success=False, error=str(e), provider='claude')

    # ── OpenAI ─────────────────────────────────────────────────────

    def _openai_completion(self, messages, model, temperature, max_tokens,
                           response_format, **kwargs) -> LLMResponse:
        try:
            import openai
            client = openai.OpenAI(api_key=self.openai_key)

            params: Dict[str, Any] = {
                'model': model,
                'messages': messages,
                'temperature': temperature,
                'max_tokens': max_tokens,
            }
            if response_format:
                params['response_format'] = response_format
            params.update(kwargs)

            resp = client.chat.completions.create(**params)

            # Exact token usage (OpenAI returns prompt/completion separately)
            input_tokens = 0
            output_tokens = 0
            cache_read = 0
            if resp.usage:
                input_tokens = getattr(resp.usage, 'prompt_tokens', 0) or 0
                output_tokens = getattr(resp.usage, 'completion_tokens', 0) or 0
                # OpenAI prompt cache hits (if available)
                pt_details = getattr(resp.usage, 'prompt_tokens_details', None)
                if pt_details is not None:
                    cache_read = getattr(pt_details, 'cached_tokens', 0) or 0

            return LLMResponse(
                success=True,
                content=resp.choices[0].message.content or '',
                model=resp.model,
                provider='openai',
                tokens_used=(resp.usage.total_tokens if resp.usage else 0),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_read_tokens=cache_read,
                finish_reason=resp.choices[0].finish_reason or '',
                raw_response=resp,
            )
        except Exception as e:
            logger.error('OpenAI completion failed: %s', e)
            return LLMResponse(success=False, error=str(e), provider='openai')

    # ── Gemini (REST API) ──────────────────────────────────────────

    GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

    def _gemini_completion(self, messages, model, temperature, max_tokens,
                           response_format) -> LLMResponse:
        try:
            url = f'{self.GEMINI_BASE}/models/{model}:generateContent?key={self.gemini_key}'

            gemini_contents, system_instruction = self._to_gemini_messages(messages)

            payload: Dict[str, Any] = {
                'contents': gemini_contents,
                'generationConfig': {
                    'temperature': temperature,
                    'maxOutputTokens': max_tokens,
                },
            }

            if system_instruction:
                payload['systemInstruction'] = {
                    'parts': [{'text': system_instruction}],
                }

            if response_format and response_format.get('type') == 'json_object':
                payload['generationConfig']['responseMimeType'] = 'application/json'

            resp = http_requests.post(
                url,
                headers={'Content-Type': 'application/json'},
                json=payload,
                timeout=120,
            )

            if resp.status_code != 200:
                error_msg = f'Gemini API error {resp.status_code}'
                try:
                    error_msg = resp.json().get('error', {}).get('message', error_msg)
                except Exception:
                    pass
                return LLMResponse(success=False, error=error_msg, provider='gemini')

            result = resp.json()

            # Extract text
            content = ''
            candidates = result.get('candidates', [])
            if candidates:
                parts = candidates[0].get('content', {}).get('parts', [])
                content = ''.join(p.get('text', '') for p in parts)

            # Strip markdown code fences (Gemini sometimes wraps JSON)
            content = content.strip()
            if content.startswith('```'):
                content = content.split('\n', 1)[1] if '\n' in content else content[3:]
                if content.endswith('```'):
                    content = content[:-3]
                content = content.strip()

            # Exact token usage (Gemini returns prompt/candidates separately)
            usage = result.get('usageMetadata', {})
            input_tokens = usage.get('promptTokenCount', 0) or 0
            output_tokens = usage.get('candidatesTokenCount', 0) or 0
            cache_read = usage.get('cachedContentTokenCount', 0) or 0
            tokens = input_tokens + output_tokens

            finish = candidates[0].get('finishReason', '') if candidates else ''

            return LLMResponse(
                success=True,
                content=content,
                model=model,
                provider='gemini',
                tokens_used=tokens,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_read_tokens=cache_read,
                finish_reason=finish,
                raw_response=result,
            )
        except Exception as e:
            logger.error('Gemini completion failed: %s', e)
            return LLMResponse(success=False, error=str(e), provider='gemini')

    # ── Message Format Conversion — Claude ────────────────────────

    @staticmethod
    def _to_claude_messages(messages: List[Dict]):
        """
        Convert OpenAI message format → Anthropic format.

        Key differences:
        - Anthropic: system message is a top-level 'system' parameter, NOT in messages
        - Anthropic: messages alternate user/assistant (no system role in messages)
        - Anthropic: vision uses 'source' with 'type': 'base64' instead of 'image_url'

        Returns (system_text, claude_messages)
        """
        system_parts: List[str] = []
        claude_messages: List[Dict] = []

        for msg in messages:
            role = msg['role']
            content = msg['content']

            if role == 'system':
                system_parts.append(content if isinstance(content, str) else str(content))
                continue

            claude_role = 'assistant' if role == 'assistant' else 'user'

            if isinstance(content, str):
                claude_messages.append({
                    'role': claude_role,
                    'content': content,
                })
            elif isinstance(content, list):
                # Vision content: convert from OpenAI format to Anthropic format
                claude_content = []
                for item in content:
                    if item.get('type') == 'text':
                        claude_content.append({
                            'type': 'text',
                            'text': item['text'],
                        })
                    elif item.get('type') == 'image_url':
                        image_url = item['image_url']['url']
                        if image_url.startswith('data:'):
                            # Base64 encoded image
                            header, data = image_url.split(',', 1)
                            mime = header.split(':')[1].split(';')[0]
                            claude_content.append({
                                'type': 'image',
                                'source': {
                                    'type': 'base64',
                                    'media_type': mime,
                                    'data': data,
                                }
                            })
                        else:
                            # URL-based image
                            claude_content.append({
                                'type': 'image',
                                'source': {
                                    'type': 'url',
                                    'url': image_url,
                                }
                            })
                if claude_content:
                    claude_messages.append({
                        'role': claude_role,
                        'content': claude_content,
                    })

        # Ensure valid alternating message order for Anthropic
        claude_messages = _ensure_valid_claude_message_order(claude_messages)

        system_text = '\n\n'.join(system_parts) if system_parts else None
        return system_text, claude_messages

    # ── Message Format Conversion — Gemini ────────────────────────

    @staticmethod
    def _to_gemini_messages(messages: List[Dict]):
        """
        Convert OpenAI message format → Gemini format.

        OpenAI:  [{"role": "system", "content": "..."}, ...]
        Gemini:  systemInstruction + contents: [{"role": "user", "parts": [...]}]

        Handles vision content (base64 images in content arrays).
        """
        system_parts: List[str] = []
        gemini_contents: List[Dict] = []

        for msg in messages:
            role = msg['role']
            content = msg['content']

            if role == 'system':
                system_parts.append(content if isinstance(content, str) else str(content))
                continue

            gemini_role = 'model' if role == 'assistant' else 'user'

            if isinstance(content, str):
                gemini_contents.append({
                    'role': gemini_role,
                    'parts': [{'text': content}],
                })
            elif isinstance(content, list):
                # Vision content: text + image_url items
                parts = []
                for item in content:
                    if item.get('type') == 'text':
                        parts.append({'text': item['text']})
                    elif item.get('type') == 'image_url':
                        image_url = item['image_url']['url']
                        if image_url.startswith('data:'):
                            header, data = image_url.split(',', 1)
                            mime = header.split(':')[1].split(';')[0]
                            parts.append({
                                'inlineData': {'mimeType': mime, 'data': data},
                            })
                        else:
                            parts.append({
                                'fileData': {'mimeType': 'image/jpeg', 'fileUri': image_url},
                            })
                if parts:
                    gemini_contents.append({'role': gemini_role, 'parts': parts})

        system_instruction = '\n\n'.join(system_parts) if system_parts else None
        return gemini_contents, system_instruction


# ── Factory ────────────────────────────────────────────────────────

def get_llm_service(user) -> UnifiedLLMService:
    """
    Build a UnifiedLLMService from user settings.
    Primary entry point for all AI call sites.

    Claude is ALWAYS the preferred provider for text/chat (global admin key).
    OpenAI/Gemini are used as fallback for text, and remain primary for
    image generation, video, voice, and embeddings.
    """
    from accounts.api_keys import get_openai_key, get_gemini_key, get_claude_key

    openai_key = get_openai_key(user)
    gemini_key = get_gemini_key(user)
    claude_key = get_claude_key(user)  # Always returns the global admin key

    # Claude is always preferred for text workflows
    preferred_provider = 'claude'
    openai_model = 'gpt-4o-mini'
    gemini_model = 'gemini-2.0-flash'
    claude_model = 'claude-sonnet-4-20250514'

    try:
        from ai_caption.models import UserAPISettings
        settings = UserAPISettings.objects.get(user=user)
        openai_model = settings.default_model or 'gpt-4o-mini'
        gemini_model = getattr(settings, 'default_gemini_model', 'gemini-2.0-flash')
        claude_model = getattr(settings, 'default_claude_model', 'claude-sonnet-4-20250514')
    except Exception:
        pass

    return UnifiedLLMService(
        openai_key=openai_key,
        gemini_key=gemini_key,
        claude_key=claude_key,
        preferred_provider=preferred_provider,
        openai_model=openai_model,
        gemini_model=gemini_model,
        claude_model=claude_model,
    )
