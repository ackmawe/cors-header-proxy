// Cloudflare Worker Proxy for IPTV - FIXED CORS & 400 ERRORS
export default {
  async fetch(request) {
    // Handle CORS preflight requests (OPTIONS method)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
          "Access-Control-Allow-Headers": "Content-Type, Range, User-Agent",
          "Access-Control-Expose-Headers": "Content-Length, Content-Range",
          "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    // Validate URL parameter
    if (!targetUrl) {
      return new Response('Missing url parameter', { 
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      return new Response('Invalid URL format', { 
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      // Parse the target URL for headers
      const targetOrigin = new URL(targetUrl).origin;
      
      // Build headers that mimic a browser
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': targetOrigin,
        'Origin': targetOrigin,
        'Connection': 'keep-alive'
      };

      // Forward Range header if present (for seeking)
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }

      // Forward any other important headers
      const forwardHeaders = ['If-Modified-Since', 'If-None-Match'];
      forwardHeaders.forEach(header => {
        const value = request.headers.get(header);
        if (value) headers[header] = value;
      });

      // Fetch the stream
      const response = await fetch(targetUrl, { 
        headers,
        // Allow redirects
        redirect: 'follow'
      });

      // Create response headers with proper CORS
      const responseHeaders = new Headers(response.headers);
      
      // Set essential CORS headers
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
      
      // Add caching headers
      if (targetUrl.includes('.ts')) {
        // Video segments - cache for 7 days
        responseHeaders.set('Cache-Control', 'public, max-age=604800');
      } else if (targetUrl.includes('.m3u8')) {
        // Playlists - cache briefly
        responseHeaders.set('Cache-Control', 'public, max-age=30');
      }

      // Return the streaming response
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(`Proxy error: ${error.message}`, { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
