# Example: Messenger Automation Integration

"""
Complete working example of messenger automation with all features
"""

from messenger_bot.models import MessengerConnection, AIConfiguration
from messenger_bot.services.message_handler import MessageHandler
from messenger_bot.services.openai_client import OpenAIClient

# ============================================================================
# EXAMPLE 1: Basic Text Message Processing
# ============================================================================

def example_text_message():
    """Process a simple text message"""
    
    # Get or create connection
    connection = MessengerConnection.objects.get(page_id='123456789')
    
    # Initialize handler
    handler = MessageHandler(connection)
    
    # Process message
    success = handler.process_message(
        sender_id='user_facebook_id',
        message_text='What are your business hours?'
    )
    
    print(f"Message processed: {success}")


# ============================================================================
# EXAMPLE 2: Processing Message with Image
# ============================================================================

def example_image_message():
    """Process a message with image attachment"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    # Message with image
    message_data = {
        'text': 'What product is this?',
        'attachments': [
            {
                'type': 'image',
                'payload': {
                    'url': 'https://example.com/product.jpg'
                }
            }
        ],
        'mid': 'message_id_123'
    }
    
    success = handler.process_message(
        sender_id='user_facebook_id',
        message_data=message_data
    )
    
    print(f"Image message processed: {success}")


# ============================================================================
# EXAMPLE 3: Processing Message with URLs
# ============================================================================

def example_url_message():
    """Process a message with URLs that get analyzed"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    # Message with URLs
    message_text = '''
    I found this article: https://example.com/blog/article
    And this product: www.amazon.com/dp/B0123456789
    What do you think?
    '''
    
    success = handler.process_message(
        sender_id='user_facebook_id',
        message_text=message_text
    )
    
    print(f"URL message processed: {success}")
    
    # URLs are automatically:
    # 1. Extracted from text
    # 2. Validated
    # 3. Content fetched
    # 4. Included in AI analysis


# ============================================================================
# EXAMPLE 4: Processing Multiple Attachments
# ============================================================================

def example_multi_attachment():
    """Process message with multiple attachment types"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    # Message with mixed attachments
    message_data = {
        'text': 'Check out these files',
        'attachments': [
            {
                'type': 'image',
                'payload': {'url': 'https://example.com/pic1.jpg'}
            },
            {
                'type': 'image',
                'payload': {'url': 'https://example.com/pic2.jpg'}
            },
            {
                'type': 'file',
                'payload': {'url': 'https://example.com/document.pdf'}
            },
            {
                'type': 'video',
                'payload': {'url': 'https://example.com/video.mp4'}
            }
        ],
        'mid': 'message_id_456'
    }
    
    success = handler.process_message(
        sender_id='user_facebook_id',
        message_data=message_data
    )
    
    print(f"Multi-attachment message processed: {success}")


# ============================================================================
# EXAMPLE 5: URL Extraction Only
# ============================================================================

def example_extract_urls():
    """Extract URLs from text without processing full message"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    text = '''
    Visit our site https://example.com
    Or check www.blog.example.com/posts
    Also see example.com for updates
    And this too http://example.com/page
    '''
    
    urls = handler._extract_urls(text)
    
    print(f"Found URLs:")
    for url in urls:
        print(f"  - {url}")
    
    # Output:
    # Found URLs:
    #   - https://example.com
    #   - https://www.blog.example.com/posts
    #   - https://example.com
    #   - http://example.com/page


# ============================================================================
# EXAMPLE 6: Image Analysis Only
# ============================================================================

def example_analyze_image():
    """Analyze a single image without full message processing"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    image_url = 'https://example.com/photo.jpg'
    
    description = handler._analyze_image_with_ai(image_url)
    
    print(f"Image Analysis Result:")
    print(description)
    
    # Example output:
    # "This image shows a modern office space with open floor plan,
    #  natural lighting from large windows, and contemporary furniture.
    #  There are several people working at desks with laptops..."


# ============================================================================
# EXAMPLE 7: Check if URL is Image
# ============================================================================

def example_check_image_urls():
    """Identify which URLs point to images"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    urls = [
        'https://example.com/image.jpg',
        'https://example.com/article.html',
        'https://cdn.example.com/pic.png',
        'https://example.com/document.pdf',
        'https://example.com/photo.gif',
    ]
    
    for url in urls:
        is_image = handler._is_image_url(url)
        print(f"{url} -> {'IMAGE' if is_image else 'NOT IMAGE'}")
    
    # Output:
    # https://example.com/image.jpg -> IMAGE
    # https://example.com/article.html -> NOT IMAGE
    # https://cdn.example.com/pic.png -> IMAGE
    # https://example.com/document.pdf -> NOT IMAGE
    # https://example.com/photo.gif -> IMAGE


# ============================================================================
# EXAMPLE 8: Process Attachments Detail
# ============================================================================

def example_process_attachments():
    """Detailed attachment processing"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    attachments = [
        {
            'type': 'image',
            'payload': {'url': 'https://example.com/pic.jpg'}
        },
        {
            'type': 'location',
            'payload': {
                'coordinates': {
                    'lat': 40.7128,
                    'long': -74.0060
                }
            }
        },
        {
            'type': 'sticker',
            'payload': {'sticker_id': '369239263222822'}
        }
    ]
    
    result = handler._process_attachments(attachments)
    
    print(f"Attachment Processing Result:")
    print(f"  Type: {result['type']}")
    print(f"  Images: {result['images']}")
    print(f"  Location: {result['location']}")
    print(f"  Sticker ID: {result['sticker_id']}")


# ============================================================================
# EXAMPLE 9: Send Message with Long Content
# ============================================================================

def example_send_long_message():
    """Handle messages longer than 2000 characters"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    # Very long message (will be split automatically)
    long_message = "This is a very detailed response... " * 100
    
    success = handler._send_facebook_message(
        recipient_id='user_facebook_id',
        message_text=long_message
    )
    
    # Handler automatically:
    # 1. Splits into 2000 char chunks
    # 2. Adds delays between sends (0.5s)
    # 3. Handles errors gracefully
    
    print(f"Long message sent: {success}")


# ============================================================================
# EXAMPLE 10: Full Webhook Message Simulation
# ============================================================================

def example_webhook_simulation():
    """Simulate complete webhook message handling"""
    
    # This simulates what Facebook would send
    webhook_data = {
        'entry': [
            {
                'messaging': [
                    {
                        'sender': {'id': '123456789'},
                        'recipient': {'id': '987654321'},
                        'timestamp': 1234567890,
                        'message': {
                            'mid': 'message_id_123',
                            'text': 'Check out https://example.com',
                            'attachments': [
                                {
                                    'type': 'image',
                                    'payload': {
                                        'url': 'https://example.com/img.jpg'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }
    
    # Extract and process
    connection = MessengerConnection.objects.get(page_id='987654321')
    handler = MessageHandler(connection)
    
    for entry in webhook_data['entry']:
        for messaging_event in entry['messaging']:
            sender_id = messaging_event['sender']['id']
            message = messaging_event['message']
            
            result = handler.process_message(
                sender_id=sender_id,
                message_data={
                    'text': message.get('text', ''),
                    'attachments': message.get('attachments', []),
                    'mid': message.get('mid')
                }
            )
            
            print(f"Webhook processed: {result}")


# ============================================================================
# EXAMPLE 11: Conversation History Context
# ============================================================================

def example_conversation_context():
    """Demonstrate how conversation history is used for context"""
    
    from messenger_bot.models import Conversation, Message
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    # Get existing conversation
    conversation = Conversation.objects.get(
        connection=connection,
        sender_id='user_facebook_id'
    )
    
    # Get recent message history
    recent_messages = Message.objects.filter(
        conversation=conversation
    ).order_by('-timestamp')[:10]
    
    print(f"Conversation History for {conversation.sender_name}:")
    print(f"Total messages: {conversation.message_count}")
    print(f"\nRecent exchange:")
    
    for msg in reversed(recent_messages):
        sender = "You" if msg.sender == 'user' else "Bot"
        print(f"{sender}: {msg.text[:100]}...")


# ============================================================================
# EXAMPLE 12: Complete Message with Analysis
# ============================================================================

def example_complete_analysis():
    """Show full message with image, URL, and text analysis"""
    
    connection = MessengerConnection.objects.get(page_id='123456789')
    handler = MessageHandler(connection)
    
    # Complex message
    message_data = {
        'text': '''
        I saw this product on https://www.amazon.com/example
        and found this article https://example.com/blog/review
        What do you think? I attached some images too.
        ''',
        'attachments': [
            {
                'type': 'image',
                'payload': {'url': 'https://example.com/product-1.jpg'}
            },
            {
                'type': 'image',
                'payload': {'url': 'https://example.com/product-2.jpg'}
            }
        ],
        'mid': 'complex_msg_123'
    }
    
    # Handler will:
    # 1. Extract URLs: amazon.com/example, example.com/blog/review
    # 2. Analyze images with GPT-4 Vision
    # 3. Fetch content from URLs
    # 4. Combine all context
    # 5. Generate intelligent response using RAG
    # 6. Send response to Facebook
    
    success = handler.process_message(
        sender_id='user_facebook_id',
        message_data=message_data
    )
    
    print(f"Complete analysis processed: {success}")


# ============================================================================
# Running Examples
# ============================================================================

if __name__ == '__main__':
    # Uncomment to run examples
    
    # example_text_message()
    # example_image_message()
    # example_url_message()
    # example_multi_attachment()
    # example_extract_urls()
    # example_analyze_image()
    # example_check_image_urls()
    # example_process_attachments()
    # example_send_long_message()
    # example_webhook_simulation()
    # example_conversation_context()
    # example_complete_analysis()
    
    print("All examples available for testing!")
