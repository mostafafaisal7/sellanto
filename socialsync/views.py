"""
Views for serving the React frontend.
"""
from django.shortcuts import render
from django.views.generic import View
from django.http import HttpResponse
from django.conf import settings
import os


class ReactAppView(View):
    """
    Serve the React frontend application.
    This view serves the React build's index.html for all frontend routes.
    """

    def get(self, request, *args, **kwargs):
        try:
            # Try to render the React index.html template
            return render(request, 'index.html')
        except Exception as e:
            # If React build doesn't exist, show helpful message
            return HttpResponse(
                f"""
                <html>
                <head><title>React App Not Built</title></head>
                <body style="font-family: Arial, sans-serif; padding: 40px; background: #1a1a2e; color: #eee;">
                    <h1 style="color: #ff6b6b;">React Frontend Not Built</h1>
                    <p>The React frontend needs to be built first.</p>
                    <h3>To build the React app:</h3>
                    <pre style="background: #16213e; padding: 20px; border-radius: 8px; color: #4ecca3;">
cd frontend
npm install
npm run build
                    </pre>
                    <h3>Or for development mode:</h3>
                    <pre style="background: #16213e; padding: 20px; border-radius: 8px; color: #4ecca3;">
cd frontend
npm run dev
                    </pre>
                    <p>Then access <a href="http://localhost:3000" style="color: #4ecca3;">http://localhost:3000</a></p>
                    <hr style="border-color: #333; margin: 30px 0;">
                    <p style="color: #888;">Error: {str(e)}</p>
                </body>
                </html>
                """,
                status=200
            )


def serve_react(request):
    """Function-based view to serve React app"""
    try:
        return render(request, 'index.html')
    except Exception:
        return HttpResponse(
            """
            <h1>React app not built</h1>
            <p>Run: <code>cd frontend && npm run build</code></p>
            """,
            status=200
        )
