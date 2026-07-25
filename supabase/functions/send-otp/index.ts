const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

const handler = async (request: Request): Promise<Response> => {
  const { emergencyPhoneNumber } = await request.json();
  
  // 1. Generate a 6-digit code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // 2. Save to your Supabase otp_tracking table here (via supabase-js)

  // 3. Trigger Twilio SMS
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const basicAuthToken = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const res = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuthToken}`
    },
    body: new URLSearchParams({
      To: emergencyPhoneNumber,
      From: TWILIO_PHONE_NUMBER,
      Body: `Your Golden Minutes verification code is: ${otpCode}`
    })
  });

  const data = await res.json();
  
  return new Response(JSON.stringify({ success: true, twilio_response: data }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
};

Deno.serve(handler);