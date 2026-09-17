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
  const maxRetries = options.retries !== undefined ? options.retries : 1; // Default to 1 retry

  const attemptSMTP = () => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
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
          socket.destroy();
          resolve({ ...result, ...finalResult, smtpChecked: true });
        }
      };

      timer = setTimeout(() => {
        finish({ smtpStatus: 'TIMEOUT', smtpMessage: 'Connection timed out' });
      }, timeout);

      socket.setTimeout(timeout);
      socket.on('timeout', () => finish({ smtpStatus: 'TIMEOUT', smtpMessage: 'Socket timeout' }));
      socket.on('error', (err) => finish({ smtpStatus: 'ERROR', smtpMessage: err.message }));

      socket.connect(25, mxHost, async () => {
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
