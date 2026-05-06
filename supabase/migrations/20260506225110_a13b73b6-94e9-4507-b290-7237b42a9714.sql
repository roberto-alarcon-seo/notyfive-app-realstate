UPDATE public.tenant_integrations
SET phone_number = '+5215596627149',
    whatsapp_sender_status = NULL,
    whatsapp_sender_error = NULL
WHERE tenant_id = 'ef473fe2-5d72-47e2-9ef5-5942bb2c18a1'
  AND provider = 'twilio'
  AND phone_number = '+525596627149';