#!/usr/bin/env python3
"""
deploy-simple.py - TBR System Simple HTTP Server Deployment
Usage: python3 deploy-simple.py [port]
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

def deploy(port=8080):
    """Start simple HTTP server for TBR System"""
    
    # Get script directory
    script_dir = Path(__file__).resolve().parent
    os.chdir(script_dir)
    
    print("\n" + "="*50)
    print("🚀 TBR System - Simple Server Deployment")
    print("="*50 + "\n")
    
    # Check if index.html exists
    if not Path('index.html').exists():
        print("❌ Error: index.html not found!")
        print(f"   Current dir: {os.getcwd()}")
        sys.exit(1)
    
    # Create custom handler
    class MyHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            # Add caching headers
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            # CORS headers (optional)
            self.send_header('Access-Control-Allow-Origin', '*')
            super().end_headers()
        
        def do_GET(self):
            # Serve index.html for SPA routing
            if self.path == '/' or self.path.endswith('/'):
                self.path = '/index.html'
            return super().do_GET()
    
    # Start server
    try:
        with socketserver.TCPServer(("", port), MyHandler) as httpd:
            print(f"✅ Server started successfully!")
            print(f"\n📍 Access at:")
            print(f"   Local:     http://localhost:{port}")
            print(f"   Network:   http://[your-ip]:{port}")
            print(f"   Login:     http://localhost:{port}/login.html")
            print(f"\n📊 Demo Users:")
            print(f"   Admin:     admin@tbr.local / admin123")
            print(f"   Tech:      tech@tbr.local / tech123")
            print(f"   Desk:      desk@tbr.local / desk123")
            print(f"\n💡 Tips:")
            print(f"   - View logs: Check console output")
            print(f"   - Stop server: Ctrl+C")
            print(f"   - Clear cache: Delete browser cookies")
            print(f"\n⚠️  Note: For production, use Docker or Nginx")
            print(f"          This is for development only\n")
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n✅ Server stopped gracefully")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Port {port} already in use!")
            print(f"   Try: python3 deploy-simple.py {port+1}")
        else:
            print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    deploy(port)
