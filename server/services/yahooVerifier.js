import axios from 'axios';

const SIGNUP_PAGE = 'https://login.yahoo.com/account/create?specId=yidReg&lang=en-US&src=&done=https%3A%2F%2Fwww.yahoo.com&display=login';
const SIGNUP_API = 'https://login.yahoo.com/account/module/create?validateField=yid';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

export async function verifyYahoo(email) {
  try {
    const username = email.split('@')[0];

    // Step 1: Get the signup page to extract cookies, acrumb, and sessionIndex
    const response = await axios.get(SIGNUP_PAGE, {
      headers: {
        'User-Agent': USER_AGENT
      },
      validateStatus: () => true
    });

    const setCookie = response.headers['set-cookie'];
    if (!setCookie || !setCookie.length) {
      throw new Error('Yahoo API: No cookies returned');
    }
    const cookieString = setCookie.join('; ');

    const acrumbMatch = cookieString.match(/s=([^;]*)&d/);
    if (!acrumbMatch || !acrumbMatch[1]) {
      throw new Error('Yahoo API: Cannot find acrumb in cookies');
    }
    const acrumb = acrumbMatch[1];

    const sessionIndexMatch = response.data.match(/\\?"sessionIndex\\?":\\?"([^"\\]*)\\?"/);
    if (!sessionIndexMatch || !sessionIndexMatch[1]) {
      throw new Error('Yahoo API: Cannot find sessionIndex in HTML/JSON');
    }
    const sessionIndex = sessionIndexMatch[1];

    // Step 2: Post to the API module
    const postData = new URLSearchParams();
    postData.append('acrumb', acrumb);
    postData.append('sessionIndex', sessionIndex);
    postData.append('specId', 'yidReg');
    postData.append('userId', username);

    const apiResponse = await axios.post(SIGNUP_API, postData.toString(), {
      headers: {
        'Origin': 'https://login.yahoo.com',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'Referer': SIGNUP_PAGE,
        'Cookie': cookieString
      },
      validateStatus: () => true
    });

    const data = apiResponse.data;
    if (!data || !data.errors) {
      console.log('Yahoo API response:', data);
      throw new Error('Yahoo API: Invalid JSON response structure');
    }

    const emailExists = data.errors.some(item => 
      item.name === 'userId' && 
      (item.error === 'IDENTIFIER_NOT_AVAILABLE' || item.error === 'IDENTIFIER_EXISTS')
    );

    return {
      smtpChecked: true,
      smtpStatus: emailExists ? '2xx' : '5xx',
      smtpCode: emailExists ? 250 : 550,
      smtpMessage: emailExists ? 'Yahoo API: IDENTIFIER_EXISTS' : 'Yahoo API: IDENTIFIER_AVAILABLE (Not Found)',
      isDeliverable: emailExists
    };

  } catch (error) {
    console.error(`Yahoo Verification Error for ${email}:`, error.message);
    return {
      smtpChecked: true,
      smtpStatus: 'ERROR',
      smtpCode: 0,
      smtpMessage: `Yahoo Bypass Failed: ${error.message}`,
      isDeliverable: false
    };
  }
}
