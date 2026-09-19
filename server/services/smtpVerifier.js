import net from 'net';
import { SocksClient } from 'socks';

const CRLF = '\r\n';
const TIMEOUT_MS = parseInt(process.env.SMTP_TIMEOUT, 10) || 15000;
const MY_DOMAIN = process.env.SMTP_SENDER_DOMAIN || 'gmail.com';

/**
 * Get SOCKS5 proxy config from environment or global settings.
 * Set SOCKS5_HOST and SOCKS5_PORT env vars to enable proxy routing.
 * Example: SOCKS5_HOST=127.0.0.1 SOCKS5_PORT=1080
 */
function getProxyConfig() {
  const host = process.env.SOCKS5_HOST || global.__smtpProxy?.host;
  const port = parseInt(process.env.SOCKS5_PORT || global.__smtpProxy?.port || '0', 10);
  if (host && port) return { host, port };
  return null;
}

/**
 * Create a TCP socket connection, optionally via SOCKS5 proxy.
 */
async function createConnection(destHost, destPort, timeout) {
  const proxy = getProxyConfig();
  if (proxy) {
    const result = await SocksClient.createConnection({
      proxy: { host: proxy.host, port: proxy.port, type: 5 },
      command: 'connect',
      destination: { host: destHost, port: destPort },
      timeout
    });
    return result.socket;
  }
  // Direct connection
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(timeout);
    sock.connect(destPort, destHost, () => resolve(sock));
    sock.once('error', reject);
    sock.once('timeout', () => reject(new Error('Connection timeout')));
  });
}

/**
 * Reads a complete SMTP response, correctly handling multiline responses.
 * A multiline response has lines starting with "XXX-" (dash).
 * The FINAL line of a response starts with "XXX " (space).
 */
function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let data = '';
    let timeoutHandle = null;

    const onData = (chunk) => {
      data += chunk.toString();
      // A complete SMTP response: the last line starts with a 3-digit code + SPACE (not dash)
      // e.g. "250 OK\r\n" or "250-extension\r\n250 OK\r\n"
      const lines = data.split('\r\n').filter(l => l.length > 0);
      const lastLine = lines[lines.length - 1];
      // Final line: 3 digits followed by a space (not a dash)
      if (lastLine && /^\d{3} /.test(lastLine)) {
        clearTimeout(timeoutHandle);
        cleanup();
        resolve(data);
      }
    };

    const onError = (err) => {
      clearTimeout(timeoutHandle);
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
    };

    // Safety timeout on individual reads to prevent hanging forever
    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error('Read response timed out'));
    }, 12000);

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

export async function verifySMTP(email, mxHost, options = {}) {
  const timeout = options.timeout || TIMEOUT_MS;
  const senderDomain = options.senderDomain || MY_DOMAIN;
  const maxRetries = options.retries !== undefined ? options.retries : 1; // Default to 1 retry

  const attemptSMTP = async () => {
    let socket;
    return new Promise(async (resolve) => {
      let isResolved = false;
      let timer = null;

      const result = {
        smtpChecked: false,
        smtpStatus: null,
        smtpCode: null,
        smtpMessage: null,
      };

      const finish = (finalResult) => {
        if (!isResolved) {
          isResolved = true;
          if (timer) clearTimeout(timer);
          if (socket) socket.destroy();
          resolve({ ...result, ...finalResult, smtpChecked: true });
        }
      };

      timer = setTimeout(() => {
        finish({ smtpStatus: 'TIMEOUT', smtpMessage: 'Connection timed out' });
      }, timeout);

      try {
        socket = await createConnection(mxHost, 25, timeout);
      } catch (err) {
        return finish({ smtpStatus: 'ERROR', smtpMessage: err.message });
      }

      socket.setTimeout(timeout);
      socket.on('timeout', () => finish({ smtpStatus: 'TIMEOUT', smtpMessage: 'Socket timeout' }));
      socket.on('error', (err) => finish({ smtpStatus: 'ERROR', smtpMessage: err.message }));

      try {
        let res = await readResponse(socket);
        let code = parseInt(res.substring(0, 3));
        if (code !== 220) return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res.replace(/\r\n/g, ' ').trim() });

        socket.write(`EHLO ${senderDomain}${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));

        if (code !== 250) {
          socket.write(`HELO ${senderDomain}${CRLF}`);
          res = await readResponse(socket);
          code = parseInt(res.substring(0, 3));
          if (code !== 250) return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res.replace(/\r\n/g, ' ').trim() });
        }

        socket.write(`MAIL FROM:<>${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));
        if (code !== 250) {
          socket.write(`MAIL FROM:<postmaster@${senderDomain}>${CRLF}`);
          res = await readResponse(socket);
          code = parseInt(res.substring(0, 3));
          if (code !== 250) return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res.replace(/\r\n/g, ' ').trim() });
        }

        socket.write(`RCPT TO:<${email}>${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));

        const message = res.replace(/\r\n/g, ' ').trim();
        let status = 'ERROR';
        if (code >= 200 && code < 300) status = '2xx';
        else if (code >= 400 && code < 500) status = '4xx';
        else if (code >= 500 && code < 600) status = '5xx';

        try { socket.write(`QUIT${CRLF}`); } catch (_) {}
        finish({ smtpStatus: status, smtpCode: code, smtpMessage: message });

      } catch (err) {
        finish({ smtpStatus: 'ERROR', smtpMessage: err.message });
      }
    });
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await attemptSMTP();
    
    // Only retry on temporary failures, timeouts, or unexpected errors
    if (res.smtpStatus === '4xx' || res.smtpStatus === 'TIMEOUT' || res.smtpStatus === 'ERROR') {
      if (attempt < maxRetries) {
        console.log(`[Anti-Greylisting] Retry ${attempt + 1}/${maxRetries} for ${email} at ${mxHost}...`);
        await new Promise(r => setTimeout(r, 2000)); // wait 2 seconds before retry
        continue;
      }
    }
    return res;
  }
}
