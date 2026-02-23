"""
Caption compliance check utility — V1.2.1 Gap 9
Checks caption text against brand do_dont_rules and returns violations.
"""

import re


def check_compliance(caption_text, brand):
    """
    Check a caption against a brand's do/don't rules.

    Args:
        caption_text: The caption text to check.
        brand: Brand model instance with do_dont_rules JSONField.

    Returns:
        dict with 'is_compliant' bool and 'violations' list.
    """
    if not caption_text or not brand:
        return {'is_compliant': True, 'violations': []}

    rules = brand.do_dont_rules or {}
    violations = []

    # Check banned keywords / "don't" rules
    dont_rules = rules.get('dont', [])
    if isinstance(dont_rules, list):
        for rule in dont_rules:
            if isinstance(rule, str) and rule.strip():
                pattern = re.compile(re.escape(rule.strip()), re.IGNORECASE)
                if pattern.search(caption_text):
                    violations.append({
                        'type': 'banned_keyword',
                        'rule': rule.strip(),
                        'message': f'Caption contains banned term: "{rule.strip()}"',
                    })

    # Check "do" rules (required elements)
    do_rules = rules.get('do', [])
    if isinstance(do_rules, list):
        for rule in do_rules:
            if isinstance(rule, str) and rule.strip():
                pattern = re.compile(re.escape(rule.strip()), re.IGNORECASE)
                if not pattern.search(caption_text):
                    violations.append({
                        'type': 'missing_required',
                        'rule': rule.strip(),
                        'message': f'Caption should include: "{rule.strip()}"',
                    })

    # Check banned_keywords list (alternative format)
    banned_keywords = rules.get('banned_keywords', [])
    if isinstance(banned_keywords, list):
        for keyword in banned_keywords:
            if isinstance(keyword, str) and keyword.strip():
                pattern = re.compile(re.escape(keyword.strip()), re.IGNORECASE)
                if pattern.search(caption_text):
                    violations.append({
                        'type': 'banned_keyword',
                        'rule': keyword.strip(),
                        'message': f'Caption contains banned keyword: "{keyword.strip()}"',
                    })

    return {
        'is_compliant': len(violations) == 0,
        'violations': violations,
    }
