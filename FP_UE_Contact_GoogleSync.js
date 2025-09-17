/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/https', 'N/log'], (record, https, log) => {

    const afterSubmit = (context) => {
        try {
            if (context.type != context.UserEventType.CREATE && context.type != context.UserEventType.EDIT) {
                return;
            }

            let newRec = context.newRecord;
            let contactName = ((newRec.getValue({ fieldId: 'firstname' }) || '') + ' ' +
                               (newRec.getValue({ fieldId: 'lastname' }) || '')).trim();
            let mobilePhone = newRec.getValue({ fieldId: 'mobilephone' });

            if (!contactName || !mobilePhone) {
                log.debug('Skipping - Missing Data', { contactName, mobilePhone });
                return;
            }

            // 🔐 Load Google API Config (hardcoded record id = 1)
            let configRec = record.load({
                type: 'customrecord_google_calender_configra',
                id: 1
            });

            let clientId = configRec.getValue('custrecord_client_id');
            let clientSecret = configRec.getValue('custrecord_client_secret');
            let refreshToken = configRec.getValue('custrecordrefresh_token');

            if (!clientId || !clientSecret || !refreshToken) {
                throw new Error('Missing Google API credentials in Config Record ID 1');
            }

            // Step 1: Generate new access token using refresh token
            let tokenResponse = https.post({
                url: 'https://oauth2.googleapis.com/token',
                body: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            let tokenObj = JSON.parse(tokenResponse.body);
            log.debug('Token Response', tokenObj);
            let accessToken = tokenObj.access_token;

            if (!accessToken) {
                throw new Error('Failed to generate access token: ' + tokenResponse.body);
            }

            // Step 2: Call Google People API to create contact
            const url = 'https://people.googleapis.com/v1/people:createContact';
            const payload = {
                names: [{ givenName: contactName }],
                phoneNumbers: [{ value: mobilePhone }]
            };

            let response = https.post({
                url: url,
                body: JSON.stringify(payload),
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                }
            });

            log.debug('Google API Response', response.body);

        } catch (e) {
            log.error('Error in afterSubmit', e);
        }
    };

    return { afterSubmit };
});
