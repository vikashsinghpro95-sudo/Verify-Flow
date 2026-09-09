import net from 'net';

const CRLF = '\r\n';
const TIMEOUT_MS = parseInt(process.env.SMTP_TIMEOUT, 10) || 10000;
const MY_DOMAIN = 'example.com'; // Should ideally be configurable

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let data = '';
    
    const onData = (chunk) => {
      data += chunk.toString();
      // Check if it's the end of a multiline response
      if (data.match(/^\d{3}( |$).*\r\n/m)) {
        cleanup();
        resolve(data);
      }
    };
    
    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
    };

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

export async function verifySMTP(email, mxHost, options = {}) {
  const timeout = options.timeout || TIMEOUT_MS;
  const senderDomain = options.senderDomain || MY_DOMAIN;
  const senderAddress = `verify@${senderDomain}`;

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const result = {
      smtpChecked: false,
      smtpStatus: null, // 2xx, 4xx, 5xx, or TIMEOUT
      smtpCode: null,
      smtpMessage: null,
      catchAll: false // we can check this externally if needed
    };

    const finish = (finalResult) => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ ...result, ...finalResult, smtpChecked: true });
      }
    };

    const timer = setTimeout(() => {
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
        // 1. Wait for greeting
        let res = await readResponse(socket);
        let code = parseInt(res.substring(0, 3));
        if (code !== 220) return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res });

        // 2. Send EHLO/HELO
        socket.write(`EHLO ${senderDomain}${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));
        if (code !== 250) {
          socket.write(`HELO ${senderDomain}${CRLF}`);
          res = await readResponse(socket);
          code = parseInt(res.substring(0, 3));
          if (code !== 250) return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res });
        }

        // 3. Send MAIL FROM
        socket.write(`MAIL FROM:<${senderAddress}>${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));
        if (code !== 250) {
           return finish({ smtpStatus: 'ERROR', smtpCode: code, smtpMessage: res });
        }

        // 4. Send RCPT TO
        socket.write(`RCPT TO:<${email}>${CRLF}`);
        res = await readResponse(socket);
        code = parseInt(res.substring(0, 3));
        
        const message = res.replace(/\r\n/g, ' ').trim();
        let status = 'UNKNOWN';
        if (code >= 200 && code < 300) status = '2xx';
        else if (code >= 400 && code < 500) status = '4xx';
        else if (code >= 500 && code < 600) status = '5xx';

        // Gracefully exit
        socket.write(`QUIT${CRLF}`);

        clearTimeout(timer);
        finish({ smtpStatus: status, smtpCode: code, smtpMessage: message });

      } catch (err) {
        clearTimeout(timer);
        finish({ smtpStatus: 'ERROR', smtpMessage: err.message });
      }
    });
  });
}
