# C:\Users\Trust computer\Desktop\Final_version_socialSync\messenger_bot\views.py
"""
Messenger Bot Views
Handles Facebook Messenger connection, PDF uploads, notifications, and configuration
"""

from django.http import JsonResponse, HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.conf import settings as django_settings
import json
import logging
import os
import traceback as tb
from datetime import datetime

from .models import (
    MessengerConnection, 
    AIConfiguration, 
    PDFKnowledgeBase,
    CustomPrompt,
    Conversation,
    Message,
    Notification
)
from .forms import (
    MessengerConnectionForm,
    AIConfigurationForm,
    CustomPromptForm,
    PDFUploadForm
)

logger = logging.getLogger(__name__)

# ============ WEBHOOK DEBUG LOGGING ============

def _log_webhook(message):
    """Write webhook debug info to a log file for cPanel debugging"""
    try:
        log_path = os.path.join(django_settings.BASE_DIR, 'webhook_debug.log')
        with open(log_path, 'a') as f:
            f.write(f"[{datetime.now()}] {message}\n")
    except Exception:
        pass


@login_required
def connect_messenger(request):
    """Main connection page for Facebook Messenger"""
    
    try:
        connection = MessengerConnection.objects.get(user=request.user)
        return redirect('messenger_bot:dashboard')
    except MessengerConnection.DoesNotExist:
        connection = None
    
    if request.method == 'POST':
        connection_form = MessengerConnectionForm(request.POST)
        ai_form = AIConfigurationForm(request.POST)
        prompt_form = CustomPromptForm(request.POST)
        pdf_form = PDFUploadForm(request.POST, request.FILES)
        
        if connection_form.is_valid() and ai_form.is_valid() and prompt_form.is_valid():
            try:
                connection = connection_form.save(commit=False)
                connection.user = request.user
                connection.save()
                
                ai_config = ai_form.save(commit=False)
                ai_config.connection = connection
                ai_config.save()
                
                prompt = prompt_form.save(commit=False)
                prompt.connection = connection
                prompt.save()
                
                if pdf_form.is_valid():
                    pdf_files = request.FILES.getlist('pdfs')
                    for pdf_file in pdf_files:
                        PDFKnowledgeBase.objects.create(
                            connection=connection,
                            file=pdf_file,
                            filename=pdf_file.name,
                            file_size=pdf_file.size,
                            status='pending'
                        )
                
                messages.success(request, f'🎉 Successfully connected {connection.page_name}!')
                return redirect('messenger_bot:success')
                
            except Exception as e:
                logger.error(f"Error creating connection: {e}")
                messages.error(request, f'Error: {str(e)}')
        else:
            for form in [connection_form, ai_form, prompt_form, pdf_form]:
                for field, errors in form.errors.items():
                    for error in errors:
                        messages.error(request, f'{field}: {error}')
    else:
        connection_form = MessengerConnectionForm()
        ai_form = AIConfigurationForm()
        prompt_form = CustomPromptForm()
        pdf_form = PDFUploadForm()
    
    context = {
        'connection_form': connection_form,
        'ai_form': ai_form,
        'prompt_form': prompt_form,
        'pdf_form': pdf_form,
    }
    
    return render(request, 'messenger_bot/connect.html', context)


@login_required
def messenger_success(request):
    """Success page after connection"""
    try:
        connection = MessengerConnection.objects.get(user=request.user)
    except MessengerConnection.DoesNotExist:
        messages.error(request, 'No messenger connection found.')
        return redirect('connect_messenger')
    
    context = {
        'connection': connection,
        'webhook_url': request.build_absolute_uri(f'/messenger/webhook/{connection.page_id}/'),
        'verify_token': connection.verify_token,
    }
    
    return render(request, 'messenger_bot/success.html', context)


@login_required
def messenger_dashboard(request):
    """Dashboard showing conversations, messages, and notifications"""
    
    try:
        connection = MessengerConnection.objects.get(user=request.user)
    except MessengerConnection.DoesNotExist:
        messages.warning(request, 'Please connect your Messenger page first.')
        return redirect('connect_messenger')
    
    # Get conversations
    conversations = Conversation.objects.filter(
        connection=connection
    ).order_by('-last_message_at')
    
    # Get notifications (unread first, then recent)
    notifications = Notification.objects.filter(
        connection=connection
    ).order_by('is_read', '-created_at')[:20]
    
    unread_count = Notification.objects.filter(
        connection=connection,
        is_read=False
    ).count()
    
    # Calculate total token usage
    from django.db.models import Sum
    total_tokens = Message.objects.filter(
        conversation__connection=connection,
        sender='bot'
    ).aggregate(Sum('tokens_used'))['tokens_used__sum'] or 0
    
    # Get selected conversation
    conversation_id = request.GET.get('conversation')
    selected_conversation = None
    messages_list = []
    
    if conversation_id:
        selected_conversation = get_object_or_404(
            Conversation, id=conversation_id, connection=connection
        )
        messages_list = Message.objects.filter(
            conversation=selected_conversation
        ).order_by('timestamp')
    
    context = {
        'connection': connection,
        'conversations': conversations,
        'selected_conversation': selected_conversation,
        'messages': messages_list,
        'notifications': notifications,
        'unread_count': unread_count,
        'total_tokens': total_tokens,
    }
    
    return render(request, 'messenger_bot/dashboard.html', context)


@login_required
def messenger_settings(request):
    """Settings page"""
    
    try:
        connection = MessengerConnection.objects.get(user=request.user)
        ai_config = connection.ai_config
    except MessengerConnection.DoesNotExist:
        messages.warning(request, 'Please connect your Messenger page first.')
        return redirect('connect_messenger')
    except AIConfiguration.DoesNotExist:
        messages.error(request, 'AI configuration not found.')
        return redirect('messenger_bot:dashboard')
    
    if request.method == 'POST':
        form_type = request.POST.get('form_type')
        
        if form_type == 'connection':
            form = MessengerConnectionForm(request.POST, instance=connection)
            if form.is_valid():
                form.save()
                messages.success(request, '✅ Connection settings updated!')
                return redirect('messenger_bot:settings')
        
        elif form_type == 'ai_config':
            form = AIConfigurationForm(request.POST, instance=ai_config)
            if form.is_valid():
                form.save()
                messages.success(request, '✅ AI configuration updated!')
                return redirect('messenger_bot:settings')
        
        elif form_type == 'new_prompt':
            form = CustomPromptForm(request.POST)
            if form.is_valid():
                prompt = form.save(commit=False)
                prompt.connection = connection
                prompt.save()
                messages.success(request, '✅ Prompt created!')
                return redirect('messenger_bot:settings')
    
    connection_form = MessengerConnectionForm(instance=connection)
    ai_form = AIConfigurationForm(instance=ai_config)
    prompt_form = CustomPromptForm()
    prompts = CustomPrompt.objects.filter(connection=connection)
    pdfs = PDFKnowledgeBase.objects.filter(connection=connection)
    
    context = {
        'connection': connection,
        'connection_form': connection_form,
        'ai_form': ai_form,
        'prompt_form': prompt_form,
        'prompts': prompts,
        'pdfs': pdfs,
    }
    
    return render(request, 'messenger_bot/settings.html', context)


# ============ NOTIFICATION VIEWS ============

@login_required
def get_notifications(request):
    """API endpoint to get notifications"""
    try:
        connection = MessengerConnection.objects.get(user=request.user)
        
        notifications = Notification.objects.filter(
            connection=connection
        ).order_by('is_read', '-created_at')[:30]
        
        unread_count = Notification.objects.filter(
            connection=connection,
            is_read=False
        ).count()
        
        data = []
        for notif in notifications:
            data.append({
                'id': notif.id,
                'type': notif.notification_type,
                'type_display': notif.get_notification_type_display(),
                'type_icon': notif.type_icon,
                'title': notif.title,
                'summary': notif.summary,
                'priority': notif.priority,
                'priority_color': notif.priority_color,
                'is_read': notif.is_read,
                'is_resolved': notif.is_resolved,
                'conversation_id': notif.conversation_id,
                'sender_name': notif.conversation.sender_name or notif.conversation.sender_id,
                'created_at': notif.created_at.strftime('%Y-%m-%d %H:%M'),
                'time_ago': _time_ago(notif.created_at),
            })
        
        return JsonResponse({
            'success': True,
            'notifications': data,
            'unread_count': unread_count
        })
    
    except MessengerConnection.DoesNotExist:
        return JsonResponse({'error': 'No connection found'}, status=404)


@login_required
def mark_notification_read(request, notification_id):
    """Mark notification as read"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            notification = get_object_or_404(
                Notification, 
                id=notification_id, 
                connection=connection
            )
            notification.is_read = True
            notification.save()
            
            return JsonResponse({'success': True})
        except:
            return JsonResponse({'error': 'Failed'}, status=400)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


@login_required
def mark_notification_resolved(request, notification_id):
    """Mark notification as resolved"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            notification = get_object_or_404(
                Notification, 
                id=notification_id, 
                connection=connection
            )
            notification.is_resolved = True
            notification.resolved_at = timezone.now()
            notification.save()
            
            return JsonResponse({'success': True})
        except:
            return JsonResponse({'error': 'Failed'}, status=400)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


@login_required
def mark_all_notifications_read(request):
    """Mark all notifications as read"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            Notification.objects.filter(
                connection=connection,
                is_read=False
            ).update(is_read=True)
            
            return JsonResponse({'success': True})
        except:
            return JsonResponse({'error': 'Failed'}, status=400)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


def _time_ago(dt):
    """Convert datetime to 'time ago' format"""
    now = timezone.now()
    diff = now - dt
    
    if diff.days > 0:
        return f"{diff.days}d ago"
    elif diff.seconds >= 3600:
        return f"{diff.seconds // 3600}h ago"
    elif diff.seconds >= 60:
        return f"{diff.seconds // 60}m ago"
    else:
        return "Just now"


# ============ WEBHOOK ============

@csrf_exempt
@require_http_methods(["GET", "POST"])
def webhook(request, page_id):
    """Facebook Messenger webhook endpoint"""
    
    if request.method == 'GET':
        mode = request.GET.get('hub.mode')
        token = request.GET.get('hub.verify_token')
        challenge = request.GET.get('hub.challenge')

        if mode == 'subscribe':
            try:
                connection = MessengerConnection.objects.get(page_id=page_id)

                if token == connection.verify_token:
                    connection.is_webhook_verified = True
                    connection.save()
                    logger.info(f"Webhook verified for page {page_id}")
                    return HttpResponse(challenge, content_type='text/plain')
                else:
                    return JsonResponse({'error': 'Invalid verify token'}, status=403)

            except MessengerConnection.DoesNotExist:
                return JsonResponse({'error': 'Connection not found'}, status=404)

        return JsonResponse({'error': 'Invalid request'}, status=400)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            _log_webhook("=" * 50)
            _log_webhook(f"WEBHOOK POST received for page: {page_id}")
            _log_webhook(f"Data: {json.dumps(data, indent=2)[:500]}")

            try:
                connection = MessengerConnection.objects.get(page_id=page_id)
                _log_webhook(f"Connection found: {connection.page_name} (auto_reply={connection.auto_reply_enabled})")
            except MessengerConnection.DoesNotExist:
                _log_webhook(f"ERROR: Connection NOT found for page_id: {page_id}")
                # Still return 200 to Facebook so it doesn't disable the webhook
                return JsonResponse({'status': 'received'}, status=200)

            if 'entry' in data:
                _log_webhook(f"Processing {len(data['entry'])} entries...")

                try:
                    from .services.message_handler import MessageHandler
                    _log_webhook("MessageHandler imported successfully")
                except Exception as e:
                    _log_webhook(f"ERROR importing MessageHandler: {e}\n{tb.format_exc()}")
                    return JsonResponse({'status': 'received'}, status=200)

                try:
                    message_handler = MessageHandler(connection)
                    _log_webhook("MessageHandler initialized OK")
                except Exception as e:
                    _log_webhook(f"ERROR initializing MessageHandler: {e}\n{tb.format_exc()}")
                    return JsonResponse({'status': 'received'}, status=200)

                for entry in data['entry']:
                    if 'messaging' in entry:
                        for messaging_event in entry['messaging']:
                            sender_id = messaging_event.get('sender', {}).get('id')

                            # Skip non-message events
                            if 'delivery' in messaging_event or 'read' in messaging_event:
                                continue
                            if 'postback' in messaging_event or 'referral' in messaging_event:
                                continue

                            if 'message' in messaging_event:
                                message = messaging_event['message']

                                if message.get('is_echo'):
                                    continue

                                message_text = message.get('text', '')
                                message_id = message.get('mid')
                                attachments = message.get('attachments', [])

                                _log_webhook(f"Message from {sender_id}: '{message_text[:100]}' (attachments: {len(attachments)})")

                                if sender_id:
                                    try:
                                        result = message_handler.process_message(
                                            sender_id=sender_id,
                                            message_data={
                                                'text': message_text or '',
                                                'attachments': attachments,
                                                'mid': message_id
                                            }
                                        )
                                        _log_webhook(f"process_message result: {result}")
                                    except Exception as e:
                                        _log_webhook(f"ERROR in process_message: {e}\n{tb.format_exc()}")

            _log_webhook("Webhook handled OK, returning 200")
            return JsonResponse({'status': 'received'}, status=200)

        except Exception as e:
            _log_webhook(f"FATAL WEBHOOK ERROR: {e}\n{tb.format_exc()}")
            logger.error(f"Webhook error: {e}", exc_info=True)
            # ALWAYS return 200 to Facebook to prevent webhook deactivation
            return JsonResponse({'status': 'received'}, status=200)


# ============ OTHER VIEWS ============

@login_required
def disconnect_messenger(request):
    """Disconnect Messenger page"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            page_name = connection.page_name
            connection.delete()
            messages.success(request, f'Disconnected {page_name}')
        except MessengerConnection.DoesNotExist:
            messages.error(request, 'No connection found.')
    
    return redirect('connect_accounts')


@login_required
def upload_pdf(request):
    """Upload PDFs to knowledge base"""
    try:
        connection = MessengerConnection.objects.get(user=request.user)
    except MessengerConnection.DoesNotExist:
        return JsonResponse({'error': 'No connection found'}, status=404)
    
    if request.method == 'POST':
        form = PDFUploadForm(request.POST, request.FILES)
        
        if form.is_valid():
            pdf_files = request.FILES.getlist('pdfs')
            uploaded_count = 0
            
            for pdf_file in pdf_files:
                PDFKnowledgeBase.objects.create(
                    connection=connection,
                    file=pdf_file,
                    filename=pdf_file.name,
                    file_size=pdf_file.size,
                    status='pending'
                )
                uploaded_count += 1
            
            return JsonResponse({
                'success': True,
                'message': f'Uploaded {uploaded_count} PDF(s)',
                'count': uploaded_count
            })
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


@login_required
def delete_pdf(request, pdf_id):
    """Delete a PDF"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            pdf = get_object_or_404(PDFKnowledgeBase, id=pdf_id, connection=connection)
            
            filename = pdf.filename
            pdf.file.delete()
            pdf.delete()
            
            messages.success(request, f'✅ Deleted {filename}')
            return JsonResponse({'success': True})
        
        except MessengerConnection.DoesNotExist:
            return JsonResponse({'error': 'No connection found'}, status=404)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


@login_required
def refresh_user_info(request):
    """Refresh user info for conversations"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            conversation_id = request.POST.get('conversation_id')
            
            from .services.message_handler import MessageHandler, update_all_conversation_user_info
            
            if conversation_id:
                conversation = get_object_or_404(
                    Conversation, id=conversation_id, connection=connection
                )
                
                handler = MessageHandler(connection)
                user_info = handler._get_facebook_user_info(conversation.sender_id)
                
                if user_info and user_info.get('name'):
                    conversation.sender_name = user_info.get('name')
                    conversation.sender_profile_pic = user_info.get('profile_pic')
                    conversation.save()
                    
                    return JsonResponse({
                        'success': True,
                        'message': f'Updated: {conversation.sender_name}',
                        'name': conversation.sender_name,
                        'profile_pic': conversation.sender_profile_pic
                    })
                else:
                    return JsonResponse({
                        'success': False,
                        'message': 'Could not fetch user info. Check Facebook API permissions.'
                    })
            else:
                updated = update_all_conversation_user_info(connection)
                return JsonResponse({
                    'success': True,
                    'message': f'Updated {updated} conversations',
                    'updated_count': updated
                })
        
        except MessengerConnection.DoesNotExist:
            return JsonResponse({'error': 'No connection found'}, status=404)
        except Exception as e:
            logger.error(f"Error: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


@login_required
def debug_facebook_api(request):
    """Debug Facebook API - check why user info is not loading"""
    import requests
    
    try:
        connection = MessengerConnection.objects.get(user=request.user)
    except MessengerConnection.DoesNotExist:
        return JsonResponse({'error': 'No connection found'}, status=404)
    
    # Get a sample conversation
    conversation = Conversation.objects.filter(connection=connection).first()
    
    if not conversation:
        return JsonResponse({'error': 'No conversations found'}, status=404)
    
    user_id = conversation.sender_id
    access_token = connection.page_access_token
    
    results = {
        'user_id': user_id,
        'page_id': connection.page_id,
        'page_name': connection.page_name,
        'token_length': len(access_token) if access_token else 0,
        'tests': []
    }
    
    # Test 1: Basic user info request (v18.0)
    try:
        url = f"https://graph.facebook.com/v18.0/{user_id}"
        params = {
            'fields': 'name,first_name,last_name,profile_pic',
            'access_token': access_token
        }
        response = requests.get(url, params=params, timeout=10)
        results['tests'].append({
            'name': 'v18.0 - name,first_name,last_name,profile_pic',
            'status_code': response.status_code,
            'response': response.json() if response.status_code == 200 else response.text[:500]
        })
    except Exception as e:
        results['tests'].append({
            'name': 'v18.0 - full fields',
            'error': str(e)
        })
    
    # Test 2: Minimal fields (v18.0)
    try:
        url = f"https://graph.facebook.com/v18.0/{user_id}"
        params = {
            'fields': 'first_name',
            'access_token': access_token
        }
        response = requests.get(url, params=params, timeout=10)
        results['tests'].append({
            'name': 'v18.0 - first_name only',
            'status_code': response.status_code,
            'response': response.json() if response.status_code == 200 else response.text[:500]
        })
    except Exception as e:
        results['tests'].append({
            'name': 'v18.0 - first_name only',
            'error': str(e)
        })
    
    # Test 3: Try v19.0
    try:
        url = f"https://graph.facebook.com/v19.0/{user_id}"
        params = {
            'fields': 'name,first_name,last_name,profile_pic',
            'access_token': access_token
        }
        response = requests.get(url, params=params, timeout=10)
        results['tests'].append({
            'name': 'v19.0 - full fields',
            'status_code': response.status_code,
            'response': response.json() if response.status_code == 200 else response.text[:500]
        })
    except Exception as e:
        results['tests'].append({
            'name': 'v19.0 - full fields',
            'error': str(e)
        })
    
    # Test 4: Check token permissions
    try:
        url = f"https://graph.facebook.com/v18.0/me"
        params = {
            'fields': 'id,name',
            'access_token': access_token
        }
        response = requests.get(url, params=params, timeout=10)
        results['tests'].append({
            'name': 'Token check (me endpoint)',
            'status_code': response.status_code,
            'response': response.json() if response.status_code == 200 else response.text[:500]
        })
    except Exception as e:
        results['tests'].append({
            'name': 'Token check',
            'error': str(e)
        })
    
    # Test 5: Check token debug info
    try:
        url = f"https://graph.facebook.com/debug_token"
        params = {
            'input_token': access_token,
            'access_token': access_token
        }
        response = requests.get(url, params=params, timeout=10)
        results['tests'].append({
            'name': 'Token debug info',
            'status_code': response.status_code,
            'response': response.json() if response.status_code == 200 else response.text[:500]
        })
    except Exception as e:
        results['tests'].append({
            'name': 'Token debug info',
            'error': str(e)
        })
    
    # Test 6: Page conversations
    try:
        url = f"https://graph.facebook.com/v18.0/{connection.page_id}/conversations"
        params = {
            'fields': 'participants,updated_time',
            'access_token': access_token
        }
        response = requests.get(url, params=params, timeout=10)
        data = response.json() if response.status_code == 200 else response.text[:500]
        
        # Look for our user in participants
        if response.status_code == 200 and 'data' in data:
            for conv in data.get('data', [])[:5]:  # Check first 5 conversations
                for participant in conv.get('participants', {}).get('data', []):
                    if participant.get('id') == user_id:
                        results['found_user_in_conversations'] = participant
                        break
        
        results['tests'].append({
            'name': 'Page conversations API',
            'status_code': response.status_code,
            'response': data if isinstance(data, dict) else data[:500]
        })
    except Exception as e:
        results['tests'].append({
            'name': 'Page conversations API',
            'error': str(e)
        })
    
    return JsonResponse(results, json_dumps_params={'indent': 2})


@login_required
def toggle_human_takeover(request, conversation_id):
    """Toggle human takeover mode for a conversation"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            conversation = get_object_or_404(
                Conversation, 
                id=conversation_id, 
                connection=connection
            )
            
            # Toggle the value
            conversation.human_takeover = not conversation.human_takeover
            conversation.save()
            
            status = "enabled" if conversation.human_takeover else "disabled"
            
            return JsonResponse({
                'success': True,
                'human_takeover': conversation.human_takeover,
                'message': f'Human takeover {status}'
            })
        
        except MessengerConnection.DoesNotExist:
            return JsonResponse({'error': 'No connection found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


@login_required
def send_manual_message(request, conversation_id):
    """Send a manual message as human (not AI)"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            conversation = get_object_or_404(
                Conversation, 
                id=conversation_id, 
                connection=connection
            )
            
            message_text = request.POST.get('message', '').strip()
            
            if not message_text:
                return JsonResponse({'error': 'Message is required'}, status=400)
            
            # Send message via Facebook API
            import requests as req
            
            url = "https://graph.facebook.com/v18.0/me/messages"
            payload = {
                'recipient': {'id': conversation.sender_id},
                'message': {'text': message_text},
                'messaging_type': 'RESPONSE'
            }
            params = {'access_token': connection.page_access_token}
            
            response = req.post(url, json=payload, params=params, timeout=10)
            
            if response.status_code == 200:
                # Save message to database
                Message.objects.create(
                    conversation=conversation,
                    sender='bot',  # Still marked as bot but it's human
                    message_type='text',
                    text=f"[Human] {message_text}",  # Mark as human message
                    model_used='human',
                    timestamp=timezone.now(),
                    delivered=True
                )
                
                conversation.message_count += 1
                conversation.save()
                
                return JsonResponse({
                    'success': True,
                    'message': 'Message sent successfully'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Facebook API error: {response.text}'
                }, status=400)
        
        except MessengerConnection.DoesNotExist:
            return JsonResponse({'error': 'No connection found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'Invalid request'}, status=400)


# ============ NOTIFICATION DELETE ============

@login_required
def delete_notification(request, notification_id):
    """Delete a notification"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            notification = get_object_or_404(Notification, id=notification_id, connection=connection)
            notification.delete()
            return JsonResponse({'success': True})
        except:
            return JsonResponse({'error': 'Failed'}, status=500)
    return JsonResponse({'error': 'Invalid'}, status=400)


@login_required
def delete_all_read_notifications(request):
    """Delete all read notifications"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            deleted = Notification.objects.filter(connection=connection, is_read=True).delete()[0]
            return JsonResponse({'success': True, 'deleted': deleted})
        except:
            return JsonResponse({'error': 'Failed'}, status=500)
    return JsonResponse({'error': 'Invalid'}, status=400)


# ============ PROMPT MANAGEMENT ============

@login_required
def activate_prompt(request, prompt_id):
    """Activate a prompt"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            prompt = get_object_or_404(CustomPrompt, id=prompt_id, connection=connection)
            CustomPrompt.objects.filter(connection=connection).update(is_active=False)
            prompt.is_active = True
            prompt.save()
            return JsonResponse({'success': True})
        except:
            return JsonResponse({'error': 'Failed'}, status=500)
    return JsonResponse({'error': 'Invalid'}, status=400)


@login_required
def delete_prompt(request, prompt_id):
    """Delete a prompt"""
    if request.method == 'POST':
        try:
            connection = MessengerConnection.objects.get(user=request.user)
            prompt = get_object_or_404(CustomPrompt, id=prompt_id, connection=connection)
            was_active = prompt.is_active
            prompt.delete()
            if was_active:
                remaining = CustomPrompt.objects.filter(connection=connection).first()
                if remaining:
                    remaining.is_active = True
                    remaining.save()
            return JsonResponse({'success': True})
        except:
            return JsonResponse({'error': 'Failed'}, status=500)
    return JsonResponse({'error': 'Invalid'}, status=400)
