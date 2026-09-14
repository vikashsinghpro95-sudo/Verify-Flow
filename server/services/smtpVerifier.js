import net from 'net';

const CRLF = '\r\n';
const TIMEOUT_MS = parseInt(process.env.SMTP_TIMEOUT, 10) || 15000; // Increased to 15s for greylisting servers
const MY_DOMAIN = process.env.SMTP_SENDER_DOMAIN || 'gmail.com'; // Use a credible domain

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

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;
    let timer = null;

    const result = {
      smtpChecked: false,
      smtpStatus: null, // 2xx, 4xx, 5xx, TIMEOUT, ERROR, BLOCKED
      smtpCode: null,
      smtpMessage: null,
    };

    const finish = (finalResult) => {
      if (!isResolved) {
        isResolved = true;
        if (timer) clearTimeout(timer);
        socket.destroy();
        resolve({ ...result, ...finalResult, smtpChecked: true });
      }
    };

    timer = setTimeout(() => {
      finish({ smtpStatus: 'TIMEOUT', smtpMessage: 'Connection timed out' });
    }, timeout);

    socket.setTimeout(timeout);

    socket.on('timeout', () => {
      finish({ smtpStatus: 'TIMEOUT', smtpMessage: 'Socket timeout' });
    });

    socket.on('error', (err) => {
      finish({ smtpStatus: 'ERROR', smtpMessage: err.message });
    });

    socket.connect(25, mxHost, async () => {
      try {
        // 1. Wait for 220 greeting
        let res = await readResponse(socket);
        let code = parseInt(res.substring(0, 3));
        if (code !== 220) {
          return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res.replace(/\r\n/g, ' ').trim() });
        }

        // 2. Send EHLO — read full multiline response
        socket.write(`EHLO ${senderDomain}${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));

        // If EHLO rejected, try HELO on a fresh attempt (some very old servers)
        if (code !== 250) {
          socket.write(`HELO ${senderDomain}${CRLF}`);
          res = await readResponse(socket);
          code = parseInt(res.substring(0, 3));
          if (code !== 250) {
            return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res.replace(/\r\n/g, ' ').trim() });
          }
        }

        // 3. Send MAIL FROM with null sender (RFC 5321 compliant probe, avoids SPF blocks)
        socket.write(`MAIL FROM:<>${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));
        if (code !== 250) {
          // Some servers reject null sender — fall back to a plausible postmaster
          socket.write(`MAIL FROM:<postmaster@${senderDomain}>${CRLF}`);
          res = await readResponse(socket);
          code = parseInt(res.substring(0, 3));
          if (code !== 250) {
            return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res.replace(/\r\n/g, ' ').trim() });
          }
        }

        // 4. RCPT TO — the definitive check for mailbox existence
        socket.write(`RCPT TO:<${email}>${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));

        const message = res.replace(/\r\n/g, ' ').trim();
        let status;
        if (code >= 200 && code < 300) status = '2xx';       // Accepted
        else if (code >= 400 && code < 500) status = '4xx';  // Temporary failure (greylisting, rate limit)
        else if (code >= 500 && code < 600) status = '5xx';  // Permanent rejection
        else status = 'ERROR';

        // Gracefully exit the SMTP session
        try {
          socket.write(`QUIT${CRLF}`);
        } catch (_) { /* ignore quit errors */ }

        finish({ smtpStatus: status, smtpCode: code, smtpMessage: message });

      } catch (err) {
        finish({ smtpStatus: 'ERROR', smtpMessage: err.message });
      }
    });
  });
}
