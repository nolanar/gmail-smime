import * as asn1js from 'asn1js';
import {Certificate, EnvelopedData, ContentInfo} from 'pkijs';
import {arrayBufferToString, stringToArrayBuffer, utilConcatBuf} from 'pvutils';

// run content js, or options page js
// check for InboxSDK
if (typeof InboxSDK !== 'undefined') {
	contentMain();
} else {
	optionsMain();
}

////////////////////////////////////////////
//  Extension content JS
////////////////////////////////////////////

// entry point of extension content
function contentMain() {
	const loadOptions = {
		appName: 'Gmail S/MIME',
		appIconUrl: chrome.runtime.getURL('res/icon/icon-lock.png')
	};
	InboxSDK.load('1.0', 'sdk_gmail-smime_9187cbd76a', loadOptions).then(sdk => {

		sdk.Compose.registerComposeViewHandler(composeViewHandler);
		sdk.Conversations.registerMessageViewHandler(messageViewHandler);

	});

	// action to take when a compose view is created
	function composeViewHandler(composeView) {
		composeView.addButton({
			title: 'Sign and Encrypt',
			iconUrl: chrome.runtime.getURL('res/icon/icon-lock.png'),
			onClick: event => {
				const compView = event.composeView;
				// event.composeView.insertTextIntoBodyAtCursor('Hello World!');
				const subject = compView.getTextContent();
				console.log(subject);
				const blob = new Blob([subject], {type: 'text/html'});
				blob.name = 'encrypted.asc';
				// compView.setBodyText(subject);
				compView.attachInlineFiles([blob]);
			},
			hasDropdown: true,
			type: 'MODIFIER',
			orderHint: 0
		});
	}

	// action to take when a message is opened
	function messageViewHandler(composeView) {
		const attachments = composeView.getFileAttachmentCardViews();
		// console.log(attachments);
		const attach = attachments[0];
		const filename = attach.getTitle();
		const fileExt = filename.substr((~-filename.lastIndexOf('.') >>> 0) + 2);

		if (fileExt === 'p7m') {
			console.log('Encrypted message detected');
			attach.getDownloadURL().then(url => {
				
				fetch(url).then(response => {
					if (response.ok) return response.arrayBuffer();
					throw new Error(response.status);
				}).then(data => {

					let asn1 = asn1js.fromBER(data);
					console.log(asn1);
					const cmsContentSimpl = new ContentInfo({ schema: asn1.result });
					const cmsEnvelopedSimp = new EnvelopedData({ schema: cmsContentSimpl.content });

					// window.alert(cmsEnvelopedSimp.recipientInfos.length);

					const privateKey = getPrivateKey();
					const publicKey = getPublicKey();
					// window.alert(arrayBufferToString(publicKey));

					asn1 = asn1js.fromBER(publicKey);
					const cert = new Certificate({schema: asn1.result});

					cmsEnvelopedSimp.decrypt(0, {
						recipientCertificate: publicKey,
						recipientPrivateKey: privateKey
					}).then(
						res => {
							console.log(arrayBufferToString(res));
						},
						err => console.warn('Failed to decrypt: ' + err.name)
					);

					console.log(cmsContentSimpl);
				}).catch(err => {
					console.warn('Looks like there was a problem. Status Code: ' + err.message);
				});
			});
		}

		// attach.addButton({
		//  tooltip: 'Decrypt Message',
		//  iconUrl: chrome.runtime.getURL('icon-lock.png'),
		//  onClick: event => {
		//      event.getDownloadURL().then(url => {window.alert(url);});
		//  }
		// });
	}

	function getPrivateKey() {
		const key = 'MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDFsJlZQuO+3/MfABBW0FOVpKhjfkbXetIVbfmubvYyo3NEtoANXDIGxGoCu5+wOjIRI1jOR++GpXF+/gNKJQFXYNLUhw+AyP0an7sDVkaqOtE+NtM9HwE3Igl+YPfEWUwazp3zadgz4eDuvZ0oBeXDQShc6ZFLFra+fMlNLLHUmvasMAv3KSuHLGRNQhETdD6bVFFPG5yKDptHZ6tfZhLiZjKVGVKQn/xuyfAFkbu4xo7AJGMCxdUxvK/I51BFFx/qyOzMk5t3ATEWl8udKiW1fAQfe9fMLH68h/qw3/GAH3l4pSGVbjfZkd9Af6ENFN3ccDE8p+zkrnrokVbh5TApAgMBAAECggEBAJM5dMrUFNYm5GG243Qzy7vLF5iZB1scXe6Vq3errXCC56pJm83XVm5Rwn1si31rqbO3tkBRtGF7Pq4LsBl8u6X+NqUOPI51oIE+acEPdKr8CK6jl+eR+o67q4RR5NN2iUYBkAIiVmA1HRXPYoXW9ojWMqAXVhwsu0XbmvL9kSY6PfV00YUJZuEF4ID3fq2Ql0N8HhOgjU9JQ6u5iBJvbAqVjCmbC5jpa7cv/luiEaTA/ngSL/M6gPZx8wJ7IFekNeiZu96X7nZTl3ovYOoBGjO4BtBTP8F0W5gNjCU5FWehpHKJpM8dWioh4QdOBw1MfzI4jaKu58hAYb15B5/1nE0CgYEA8hqbNEQjr6os84LPb/62bTQ/v8NziEkdIj0enZH/XYQJ+Yv/58eSLxQm61KqUPUm1bFFw50FzxvHGdEiWObfPhZpWEVGhqiMiGGVOqo7KSNr5u8M/VgeHGNfybAnzX/g/l5xhY2dz90OMuVs2euWNZGpHFF8JE/sv+0DRphFYWcCgYEA0QljFPwAuhhA6GQ69YW5z8QJwrWsEi1tpDaK+dxHczuDfUN+ELM9Pxo3pwx1GPo7qk2aeOlf7n+k8HMdFfF3u9RYAPRb+io9gzXuafBTnRwahIGco0f7CNkfRgwsasPHGdHSxDhaEvx3h6eMHgUwZazI2va3z5JxWpErNTFJF+8CgYEAsKafNmy9iTBnaiq5RyOYYmgsV7S6OOf4PQJRs3FS3h441P/E8o7Y6EcQ+sWvhjDKbEPT/p41HeBLz1ecczfKDlh19zVc92ZGXECvjUWmsyaoVbF5TeWc2uPbgaNp93Tma1PoCyXAz2mhMZvbZ8qRKHcm6IXAShKTUZsTt8/lV+MCgYAE25X839pYeMXRYLrqB8CIroKXjsc/6ORaY5YZNmBGskRc/duJIdEzjTVr4WM7QF1wmLsVQj8jeL3phJNRdjoVGFsvMn6MsryZNwCiX55h0Uxgde6g8MRJsVoDs7a4iHIxDGo8ex7EwC867M7Zx78XLcvBIuiknz+ZHjSF2O5c6wKBgQCQzKHigGoDtlF2xYeDaRRfPG2NrgrVwDlQuPbB5WcjiZJ0Y+qy9xCEb94GTho4y/KiE4lcP29uHe28eYCzFl7n7IIX0J5TXFccZSEo/+vkADLoIgsLzu8OQemU++o32zBXR9Hb9JoOI/GKhI4yxxdJH4cJUarCEf3UX+4Qj+w6yA==';
		// const key = 'MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDNeI93DbbwmAzXQ2AS526VGJfJ4ebX95Z7/1yPVl0m/IdnOljm5M3mbIEwDngYjEePOTXlrTReUMNsLM3xTP3TM9xMlOO9ZQbS/EzpBPAg/qhz6x4chOcPx3nGKGqTjGhJxh6dVj84JVyoKzMPcVHFdcS0ZiehoSgUPoDCJgcj6JjIuFmDCi0aMiYh/Z9ieO2HfMW29iairb+VgT8IeSbiOzzisTuBhXTYgZkdN+uoY4l/VpgOhbVG6Bt0A9jjqaIEh/3TdB5pH3uhI9SHQid2PjJyGY4a0VWdknjIu0CmL/52XWn25hTJgFFd7q/NVLGtqWY8U05ITF5kPEbJClCRAgMBAAECggEBAMhkVZ9qK8p4sMVdO50UQ+B7zMYjYQ2utgCXLAHL3CwCzFgcKsp9ymZ52oExC2X9omkIBg3LoDCAGigthmlZipBqmufBql9z4XTyhlwY6c10MHxliceMwwG7rYNatZ7TqH6TEBapIB01KyoEf9cG0RaA5mh+3RYg48LitpcjmYElP/PWu+vO5h4Js3Id1mdyV5PZu4w2Jtkn5B0p9HCwxnFm6tAwjftsOhTSFZOd7uk9BS1X5iXJCcasN5FCcpBIkYL26eGXAkV+An6UcsOYWp+9UUZlQOKfprznXroozDrBNU3XZQAxHrYGB/lVEdFth3yh1BL4gRpXAeipQa7O2aUCgYEA7k4E44PNaq0Ma8ISd2IFVdXyHFttEfXiU2fUmMBQ2PC66kRuaKFE8p+aQPyeS4fZkvoudYfX455nRRyT3GdYOrv37utw/f7lknkjdqKdFCEX6E89NPW2LIBwWVtaRqO5v+EOOj6ksQyVjrAeYXJIaiQGC4Y8llJ+f0FapnYdC2MCgYEA3LplmdVU60qmv9m7PnlJBnbjakGF31MWWsuv4yd7cZnUgtQLmXQfd8Kxl8uMOduYAezsTJ830t5zAqg43xrGY1L9lLSvo48b4kXhYp12y2xIp3NJc9006qN4mKyki/LcIulBYZHu6Tj1fIO3BUt/l+SpsyJ/wCGi94ybFd02SHsCgYBNQDNrgaWMiE53fDE6TCdInRNgR+8CnH/i48zSO725pcgh+08DUgwkzsJVgM7b000fzURUS1Yb7pSxncL89u9uEtMbu20kmYXYRrbNVYewJ841O8KusVx97qD9BpUsQxUK860GCpqe3mJ5H/SpSD/bUJQ5Fin73QAuxoPZZH6j2wKBgQCgNWqpTX5libmeZprRrZajaoeGCCjy/4uqO01ewrmGqvDkRKRmrTJp6pacZtFQ7WJXg2+/7ZDHLU6tDwy4Yua8EPCdjsgtHyJOCgqdWU1wORhC8hrOTjCqXhyaNDT6nzvI2yTpfNK71OvZhIDDBxmFViMWMmQnQELZCuVF6VoNIQKBgQCRnZx3w21ErlBBklLigtlS0o85BsPIsWUCVp1tHslippJBgS1gnvpmoMSu5jy/VJzcKJKcCl0xzRDcR+1tYz+LLJtrvj19Ddd/o1buVt+tit2PDLp50Oo+B9C9kN6rT1X2+VEy62aiSUegnwK8CJkoBaob8tVoGitoheK1uizD3Q==';
		// const key = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCnf8wuMVD/POYSQCpindruu4FNeduqvoX2jKsfV9bcy7BChw9orMXvojczS0/t5PoB9zXgx0twZYI+7+Sc0yn/lDCl/VCfB05vxC0cdXK7AP/kliYniua4IFF+g7hXILudWbzFSS1bMlD1/C27ik3hjgk1CxoSlexxUkFft/6xLYHW8wxIrE0+uAf+aWFk1Lmx0xFqOhckP8Ub4VqZhXqOjxV3G2jsp5Rb/DMIW/YeZMsC4SohuZX153QC3y0j6+nsLZfR0TsyUrsWPdo3WA4bbx4H36h4qfc7ZynYeiWiqEV7JJKnnn6IIIXCNUYHYXiEcKHNCGA3eA7DV4yDX35FAgMBAAECggEAORN3RBZR/2eFDpsG1mvr+oWyXfA0Rk5937G3bgrEkKBoA4N6YLTfDfU80iHLrsjj2F+g4GOI9VfhtgiQ4k+idBDPMwDKxCX9OGCk7pmm6spAaGgxwC+4xu1cV7wSyL3CsK+vf5qb9gODSw8PlmRefYmk4YpS7BpiY4sf87oC8+R8vdKtlMM8O7MrPXMmUIQBpMRgogc7btr6zOYTFr/2YSn8A7uxtMwQFwKpEmLUmZF0Z7Wlumg4WQcdjAD2470zQio7OIDt4O4GMFex6TJ2C9qbbOFSk+2N6rsllbYbItUYnvQUiAKrZ6yl4pXPMZvQQ+PU1tX3Aw8NZFjnuR/r0QKBgQDThfCYHmWqlgnY9ObZTOKw8aUub7T+o4QW9i692jncBQcYbsZNRhi0F0cVXcKGttCg+u32PUVe/o8B0A5DsVEJo1L/vpjrEecwSrJS+rX6QzHjuYGhWpED+it8XyHPEAqiwD5ewCaq978A3VxrA4IzG8zZ00ay+iSkEhFvG6YCTwKBgQDKuBhJb6ST6ALLqmHi+p5TqprdQ+MUH3NCNaUKMKf0i6LkEY1mS2GQCREBXOD6bYQjgargElS6RrlZ0IX0QtManhQUE9B5MKdA5eOiAUtgk65Dzb1dCFyEYLjmXkuJC/EA6Z2rH0fqjjmnkWWycQPLfNwsLkXCaYFD3IiCiOF1KwKBgDp13U4dsJmaCDS3UwohztF6p92SsCJkjQBPoBGGu9EMbq6ZByOaSP+VI2dLV5Ul97lWQOh6fK7JijrFBvw8iJoyUqEuS1NEynG1Y129vwfhBGvc/G/c+RFxVg10uYJh+56JpXNIhidge6DAjWdiO9zmRRK66uJSckgKWlkr+hDPAoGBAIZYCoBgZIlAsNmYSNbLkDGSVp9cZhjn3tJ6Cq3+INCH2aObnkG0oyt5VrO4gcB046VEQaHNhCkOxbcn4h5GSvDQ4i2MFBS8kZsIvxqWEQYn2M1Gg8Ar0mRIVUEWLKjeKRGZwMuvJ1Hif4L1cJgZHZK1ZJRC9igpE2mNtUoMvJ2RAoGAZDYrjy8cP1UhoxqJhLzCm0XrpbTu0LBLQvhYL7Qmk1XYAQKpEgsTPIiJd+bdzaFTOWjiud04UIbzKc1L6Y8g0ErVGuTRP81cuYS8u91+sVqRFaXy2sCo+lx0Y0FroUfJ8k7DWhefv0vqoLaDkuneVPZoCsp2A3k/PC2/9mfJrKo=';
		return stringToArrayBuffer(window.atob(key));
	}

	function getPublicKey() {
		const key = 'MIIDTzCCAjcCCQC/jInl4oVuDjANBgkqhkiG9w0BAQsFADBOMQswCQYDVQQGEwJJRTEPMA0GA1UECAwGRHVibGluMRYwFAYDVQQKDA1hcmFubm9sYW4uY29tMRYwFAYDVQQDDA1hcmFubm9sYW4uY29tMB4XDTE3MDMzMTE5NTMyMloXDTE3MDQzMDE5NTMyMlowgYQxCzAJBgNVBAYTAklFMQ8wDQYDVQQIDAZEdWJsaW4xCjAIBgNVBAcMAS4xCjAIBgNVBAoMAS4xCjAIBgNVBAsMAS4xHDAaBgNVBAMME25vbGFuYXJhbkBnbWFpbC5jb20xIjAgBgkqhkiG9w0BCQEWE25vbGFuYXJhbkBnbWFpbC5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDFsJlZQuO+3/MfABBW0FOVpKhjfkbXetIVbfmubvYyo3NEtoANXDIGxGoCu5+wOjIRI1jOR++GpXF+/gNKJQFXYNLUhw+AyP0an7sDVkaqOtE+NtM9HwE3Igl+YPfEWUwazp3zadgz4eDuvZ0oBeXDQShc6ZFLFra+fMlNLLHUmvasMAv3KSuHLGRNQhETdD6bVFFPG5yKDptHZ6tfZhLiZjKVGVKQn/xuyfAFkbu4xo7AJGMCxdUxvK/I51BFFx/qyOzMk5t3ATEWl8udKiW1fAQfe9fMLH68h/qw3/GAH3l4pSGVbjfZkd9Af6ENFN3ccDE8p+zkrnrokVbh5TApAgMBAAEwDQYJKoZIhvcNAQELBQADggEBACFWufrJPUMamo/xb3dxnYvzfRBDq1/ojodnWLH8VIRqHlp13rifI+Y1ei2B48Co+7ku9bv/rASdCvwxaQnGMZqTquwqciAqdGMazkBRjq6OtQTCK8ogRi/zTz/c8I5ZOY2ehgCDZKXGERE3U5EbIkh+Pe5AUKc2TxpAdV6FFwvBNAKJJNmiAdmmEEHCUl/7q1CJlIlm2OGesZA7Lt04bqI9kZ+TEJTDKfwWF8BiBKaRySnXnXG4I+jqrrrT5xB3nrdOCghAkl0Z5jqJACWFbMTFgG+hljEJP29bkYTGuvlaK8dSSm0NgL4rcPCtLef7Z2AnmCJ7Cy5cHoN7A23BrPA=';
		// const key = 'MIIC0zCCAb2gAwIBAgIBATALBgkqhkiG9w0BAQUwHjEcMAkGA1UEBhMCUlUwDwYDVQQDHggAVABlAHMAdDAeFw0xNjAyMDEwMDAwMDBaFw0xOTAyMDEwMDAwMDBaMB4xHDAJBgNVBAYTAlJVMA8GA1UEAx4IAFQAZQBzAHQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDNeI93DbbwmAzXQ2AS526VGJfJ4ebX95Z7/1yPVl0m/IdnOljm5M3mbIEwDngYjEePOTXlrTReUMNsLM3xTP3TM9xMlOO9ZQbS/EzpBPAg/qhz6x4chOcPx3nGKGqTjGhJxh6dVj84JVyoKzMPcVHFdcS0ZiehoSgUPoDCJgcj6JjIuFmDCi0aMiYh/Z9ieO2HfMW29iairb+VgT8IeSbiOzzisTuBhXTYgZkdN+uoY4l/VpgOhbVG6Bt0A9jjqaIEh/3TdB5pH3uhI9SHQid2PjJyGY4a0VWdknjIu0CmL/52XWn25hTJgFFd7q/NVLGtqWY8U05ITF5kPEbJClCRAgMBAAGjIDAeMA8GA1UdEwQIMAYBAf8CAQMwCwYDVR0PBAQDAgAGMAsGCSqGSIb3DQEBBQOCAQEAGmooxXKmtARCfH1oduAuuCFag3Q8bM7C2X556fVCqrt4+65Iz3/L2lGY9lcul5VEzWT20KlBdWx25DscygoI299XC/ef4+WX6/JG85U15gfpaYxmBk5JDNayUPQUqgZuiqONp2zNN+CvigRXn78BUJwdoa78J7ftdyKVTt1PKw6mTvwoXeTABX7ya15mxbFKR6zQohM/xqaWCVjGfQJqeoc82WYFyIktGxS6rjYLZJ5PrNmvkTnYRHXxNISbRiLAkKzpnVULP87OdXB9wJBJVKabRZWq53K4DXPWoDnZwri/52XfLN4eVwa/tony8OXgxZD2AtwzjGxYy0Oiv6HvKQ==';
		// const key = 'MIIC0zCCAb2gAwIBAgIBATALBgkqhkiG9w0BAQUwHjEcMAkGA1UEBhMCUlUwDwYDVQQDHggAVABlAHMAdDAeFw0xNjAyMDEwMDAwMDBaFw0xOTAyMDEwMDAwMDBaMB4xHDAJBgNVBAYTAlJVMA8GA1UEAx4IAFQAZQBzAHQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQD1cMZ/rdfYjzIUPbwosCrpC5UXmSDxW8WDk4OOqqy26jht+D0t6jXmIrhD8mRobX2JKVjVr2p+XGNVTYj5b6mgbry8bCCAECBJUiBlpUSxnWhMm8k/aFnr/dQfLuAgma4+Yq3d3qS9Zt7gGTen8p6bLSp3wAvh820+3LGsqdPeoHQRdrWHQ2dze8SjYujhrdFb5RWvlRGxtNZC87c8iBgjEH8fHvVtGd9B1WtQYRTzo8GAcQiw6F/wp+iBbzKeWrRn5upBSWMF9LtPsG/zCjZwebwZDfseN/6BF7IdC5y+of8daFmVsWLN0SS58vVLZqcFuwUVN9Ve7yJR+I2FSFO3AgMBAAGjIDAeMA8GA1UdEwQIMAYBAf8CAQMwCwYDVR0PBAQDAgAGMAsGCSqGSIb3DQEBBQOCAQEAXS0kdsmiipwdjveTKF7xFmLiMVdJvCA04pbBVAr7QgO34K/jE8rirq2kzXHnqHoNXRyiF0nMDlKQYOda30qJ9kmgZDRKR9YYJNpCH67C4YphabiIqdD4m8IJSp2zIrKkYrWB6sDjJHWQvpBmbNrUN/5pf1bXO9XF7ueWJgplbiue2wqI4QAcC278zYizimPoebIrd1gbbfkQIQ9daL8Wv4Aa2xcok533bZThuTS/i2aN1GVzmuYkPu1eEj632Z2zipddLLEi6i62vdpQc7rtOCtvkI8D0dC5/XpV0LHZsP6EwOMahri2bBPxh0ZDnBzebN7yZTVTveYsZEfOAO7kzg==';
		return stringToArrayBuffer(window.atob(key));
	}

	function test() {

		//region Decode input certificate 
		let asn1 = asn1js.fromBER(getPublicKey());
		const certSimpl = new Certificate({ schema: asn1.result });
		console.log(certSimpl);
		//endregion 
		
		//region Decode input private key 
		const privateKeyBuffer = getPrivateKey();
		console.log(privateKeyBuffer);
		//endregion 
		
		//region Parse S/MIME message to get CMS enveloped content 
		
		// Parse MIME message and extract the envelope data
		const data_ascii = 'MIICBAYJKoZIhvcNAQcDoIIB9TCCAfECAQIxggGmMIIBogIBADBbME4xCzAJBgNVBAYTAklFMQ8wDQYDVQQIDAZEdWJsaW4xFjAUBgNVBAoMDWFyYW5ub2xhbi5jb20xFjAUBgNVBAMMDWFyYW5ub2xhbi5jb20CCQC/jInl4oVuEDA8BgkqhkiG9w0BAQcwL6APMA0GCWCGSAFlAwQCAwUAoRwwGgYJKoZIhvcNAQEIMA0GCWCGSAFlAwQCAwUABIIBAC05u3M6Jp1SbKmwvSh3ltn5LVhCz/dJGRXNg2gzLZcvoWB8M1TMAyiRcRO5F85X/sk3TBMaXNR38uo0SK2CMaj/hrDaaM5TeAYyFNHXR48kOBDiZW9b23G0pLoNDWtJni8robNMfPRy28jCn/QEP0SO/FVwmoojqKDkxlpH6UQmPPOwfcoeWXUvUxkvVGuZVKauok8U63ol3aIQWP6BPIGzYuKgtXOUL5kSJX+WGlj/RrZ8duciRHYvtI4jIhDGIhsn3FGaoFxfLXHlCMXgcansy9xdsl5PyqIX+rX71U8TqCdp596iv3EdeN/2QjYZiUdmcahHZFb9sU5QYJymlsIwgAYJKoZIhvcNAQcBMB0GCWCGSAFlAwQBAgQQsBLynSqiWb1+XNxMFeGiFqCABBCwxdOMzUJjeE2bkVLUModGAAAAAA==';
		const cmsEnvelopedBuffer = stringToArrayBuffer(window.atob(data_ascii));

		asn1 = asn1js.fromBER(cmsEnvelopedBuffer);
		console.log(asn1);
		const cmsContentSimpl = new ContentInfo({ schema: asn1.result });
		const cmsEnvelopedSimp = new EnvelopedData({ schema: cmsContentSimpl.content });
		//endregion 
		
		cmsEnvelopedSimp.decrypt(0,
			{
				recipientPrivateKey: privateKeyBuffer
			}).then(
			result => { document.getElementById('decrypted_content').innerHTML = arrayBufferToString(result); },
			error => console.error(`ERROR DURING DECRYPTION PROCESS: ${error}`)
		);
	}
}



////////////////////////////////////////////
//  Options page JS
////////////////////////////////////////////
function optionsMain() {
	// config
	let storage = chrome.storage.local;

	// TEST DATA
	let testCerts = [
		{
			'name': 'alice@example.com',
			'serial': '00:BF:8C:89:E5:E2:85:6E:0F',
			'begin': '31/03/17',
			'expire': '30/04/17'
		},
		{
			'name': 'bob@example.com',
			'serial': '00:BF:8C:89:E5:E2:85:6E:0E',
			'begin': '31/03/17',
			'expire': '30/04/17'
		},
	];

	storage.set({'signature': testCerts});
	storage.set({'encryption': testCerts});

	// identifiers
	const $table = $('#certTable');
	const $button = $('#deleteButton');

	// variables
	let certType;
	let selections = [];

	// Initialise table headers and data
	const columns = [
		[{
			'field': 'state',
			'checkbox': 'true'
		},
		{
			'field': 'name',
			'title': 'Certificate Name',
		},
		{
			'field': 'serial',
			'title': 'Serial Number',
		}, {
			'field': 'begin',
			'title': 'Begins On',
		}, {
			'field': 'expire',
			'title': 'Expires On',
		}]
	];

	$(() => {
		$('#certTable').bootstrapTable({
			columns: columns
		});

		$table.on('check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table', () => {
			$button.prop('disabled', !$table.bootstrapTable('getSelections').length);
			// save your data, here just save the current page
			// selections = getIdSelections();
			// push or splice the selections if you want to save all data selections
		});
	});

	// Certificate type tabs
	$(() => {
		// when page first loads
		selectCertTable($('#certTabs li.active a').attr('id'));
		// when tab clicked
		$('#certTabs').on('click', 'a', function(){
			selectCertTable($(this).attr('id'));
		});
	});

	function selectCertTable(id) {
		certType = id;

		$table.bootstrapTable('showLoading');
		storage.get(certType, result => {
			const items = result[certType];
			if (items !== undefined) {
				$table.bootstrapTable('load', items);
			} else {
				$table.bootstrapTable('removeAll');
			}
		});
		$table.bootstrapTable('hideLoading');
	}

	// delete cert button
	$(() => {
		$button.click(() => {
			bootbox.confirm('Are you sure you want to delete these?', result => {
				if (result) {

					const ids = $.map($table.bootstrapTable('getSelections'), row => {return row.name;});
					$table.bootstrapTable('remove', {field: 'name', values: ids});
					$button.prop('disabled', !$table.bootstrapTable('getSelections').length);

					storage.get(certType, result => {
						const itemsOld = result[certType];
						const itemsNew = itemsOld.filter(item => {
							return !ids.includes(item.name);
						});

						if (itemsNew.length > 0) {
							storage.set({[certType]: itemsNew});
						} else {
							storage.remove(certType);
						}
					});
				}
			});
		});
	});
}