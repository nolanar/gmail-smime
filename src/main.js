import * as asn1js from 'asn1js';
import {Certificate, EnvelopedData, ContentInfo} from 'pkijs';
import {arrayBufferToString, stringToArrayBuffer, bufferToHexCodes} from 'pvutils';

// run content js, or options page js
// check for InboxSDK
if (typeof InboxSDK !== 'undefined') {
	contentMain();
} else {
	optionsMain();
}

let storage = chrome.storage.local;

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
		// encrypt the message using AES-CBC and RSAES-OEAP
		composeView.addButton({
			title: 'Sign and Encrypt',
			iconUrl: chrome.runtime.getURL('res/icon/icon-lock.png'),
			onClick: event => {
				const recipient = composeView.getToRecipients()[0].emailAddress;
				storage.get('encryption', result => {
					if (typeof result['encryption'] === 'undefined') {
						alert("No certificates found");
						return;
					}
					const certs = result['encryption'];
					const certObj = certs.find(e => e.name === recipient);
					if (typeof certObj === 'undefined') {
						alert(`No certificate found for ${recipient}`);
						return;
					}

					const cert = parseCert(certObj.cert, false).cert;

					const compView = event.composeView;
					const content = stringToArrayBuffer(compView.getTextContent());

					const cmsEnveloped = new EnvelopedData();
					cmsEnveloped.addRecipientByCertificate(cert);
					const alg = {name: "AES-CBC",	length: 128};
					cmsEnveloped.encrypt(alg, content).then(() => {

						const cmsContentSimpl = new ContentInfo();
						cmsContentSimpl.contentType = "1.2.840.113549.1.7.3";
						cmsContentSimpl.content = cmsEnveloped.toSchema();

						const schema = cmsContentSimpl.toSchema();
						const ber = schema.toBER(false);

						const blob = new Blob([ber], {type: 'application/pkcs7-mime'});
						blob.name = 'smime.p7m';
						compView.attachInlineFiles([blob]);
						compView.setBodyText('');
					});


				});
			},
			hasDropdown: true,
			type: 'MODIFIER',
			orderHint: 0
		});
	}

	// action to take when a message is opened
	function messageViewHandler(messageView) {
		const attachments = messageView.getFileAttachmentCardViews();
		const attach = attachments[0];
		const filename = attach.getTitle();
		const fileExt = filename.substr((~-filename.lastIndexOf('.') >>> 0) + 2);

		// if the file is a pkcs7 envelope file, attempt to decrypt it
		if (fileExt === 'p7m') {
			messageView.getBodyElement().innerHTML = 'Decoding message...';
			attach.getDownloadURL().then(url => {
				
				fetch(url).then(response => {
					if (response.ok) return response.arrayBuffer();
					throw new Error(response.status);
				}).then(data => {

					let asn1 = asn1js.fromBER(data);
					const cmsContentSimpl = new ContentInfo({ schema: asn1.result });
					const cmsEnvelopedSimp = new EnvelopedData({ schema: cmsContentSimpl.content });

					storage.get('account', result => {
						if (typeof result['account'] === 'undefined') {
							alert("Account certificate not set up. Go to extension options page.");
							messageView.getBodyElement().innerHTML = 'Failed to decode';
							return;
						}
						const account = result['account'];

						const key = stringToArrayBuffer(window.atob(account.key));
						const cert = parseCert(account.cert, false).cert;

						cmsEnvelopedSimp.decrypt(0, {
							recipientCertificate: cert,
							recipientPrivateKey: key
						}).then(
							res => {
								messageView.getBodyElement().innerHTML = arrayBufferToString(res);
							},
							err => {
								messageView.getBodyElement().innerHTML = 'Failed to decode: ' + err;
							}
						);

					});
				}).catch(err => {
					messageView.getBodyElement().innerHTML = 'Failed to decode: ' + err;
					loader.destroy();
				});
			});
		}
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

	// storage.set({'signature': testCerts});
	// storage.set({'encryption': testCerts});

	// identifiers
	const $table = $('#certTable');
	const $button = $('#deleteButton');

	// variables
	let certType;
	let selections = [];
	let deleteEnabled;
	let uploadEnabled = false;
	let selectedCert;
	let selectedKey;

	function updateDeleteButtonState() {
		deleteEnabled = $table.bootstrapTable('getSelections').length > 0;
		$button.attr('disabled', !deleteEnabled);
	}

	function updateUploadButtonState(state) {
		uploadEnabled = !state;
		$('#updateAccountButton').attr('disabled', state);
	}

	$(() => {
		$table.on('check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table', () => {
			updateDeleteButtonState();
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

	// Switch cert table being viewed
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
			
			updateDeleteButtonState();
			$table.bootstrapTable('hideLoading');
		});
	}

	// delete cert button
	$(() => {
		$button.click(() => {
			if (deleteEnabled) {
				bootbox.confirm('Are you sure you want to delete these?', result => {
					if (result) {

						const ids = $.map($table.bootstrapTable('getSelections'), row => {return row.name;});
						$table.bootstrapTable('remove', {field: 'name', values: ids});
						updateDeleteButtonState();

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
			}
		});
	});

	// update account cert
	$(document).on('change', '#accountCert', function() {
		const input = $(this);
		let files = input.get(0).files;
		if (input.get(0).files.length > 0) {
			const file = input.get(0).files[0];

			const reader = new FileReader();
			reader.onload = event => {
				const certContent = event.target.result;
				// parse the cert and get cert object
				try {
					selectedCert = parseCert(certContent).cert;
					// enable private key input
					$('#accountKey').fileinput('enable').fileinput('refresh', {showUpload: false});
				} catch (err) {
					$('#accountCert').fileinput('refresh', {showUpload: false});
					bootbox.alert({ 
						title: 'Error',
						message: 
								'<p class="lead">File not a valid X.509 Certificate</p>' +
								`<em>${err.message}</em>`
					});
				}
			};
			reader.readAsText(file);
			updateUploadButtonState(true);
		}
	});

	// update account key
	$(document).on('change', '#accountKey', function() {
		const input = $(this);
		let files = input.get(0).files;

		if (input.get(0).files.length > 0) {
			const file = input.get(0).files[0];

			const reader = new FileReader();
			reader.onload = event => {
				const key = event.target.result;
				// parse the cert and get cert object
				try {
					selectedKey = parseKey(key);
					/* TODO: check public and private keys match*/
					// enable private key input
					updateUploadButtonState(false);
				} catch (err) {
					$('#accountCert').fileinput('refresh', {showUpload: false});
					bootbox.alert({ 
						title: 'Error',
						message: 
								'<p class="lead">File not a valid PKSC#8 Key</p>' +
								`<em>${err.message}</em>`
					});
				}
			};
			reader.readAsText(file);
		}
	});

	// update account button
	$(() => {
		$('#updateAccountButton').click(() => {
			if (uploadEnabled) {
				bootbox.confirm({
					message: 'Replace old certificate and key?',
					buttons: {
						confirm: {label: 'Yes', className: 'btn-success'},
						cancel: {label: 'No', className: 'btn-danger'}
					},
					callback: result => {
						if (result) {
							storage.set({account: {cert: selectedCert, key: selectedKey} });
							clearUploadInput();
						}
					}
				});				
			}
		});
	});

	// clear upload input button
	$(() => {
		$('#clearButton').click(() => {
			clearUploadInput();
		});
	});		

	function clearUploadInput() {
		$('#accountCert').val('');
		$('#accountKey').val('');
		$('#accountCert').fileinput('refresh', {showUpload: false});
		$('#accountKey').fileinput('disable').fileinput('refresh', {showUpload: false});
		updateUploadButtonState('true');
	}

	// add new cert
	$(document).on('change', '#addCertFile', function() {
		const input = $(this);
		let files = input.get(0).files;
		if (input.get(0).files.length > 0) {
			const file = input.get(0).files[0];

			const reader = new FileReader();
			reader.onload = event => {
				const certContent = event.target.result;
				// parse the cert and get cert object
				try {
					const parsedCert = parseCert(certContent);
					// self signed cert
					if (parsedCert.name === parsedCert.issuer) {
						storeCert(parsedCert);
					} else {
						// check if signed by a stored authority
						storage.get('authority', result => {
							let auths = result['authority'];
							if (typeof auths === 'undefined') {
								bootbox.alert({ 
									title: 'Error',
									message: '<p class="lead">No certificate authorities found</p>'
								});
								return;
							}
							const auth = auths.find(e => e.name === parsedCert.issuer);
							if (typeof auth === 'undefined') {
								bootbox.alert({ 
									title: 'Error',
									message: `<p class="lead">Certificate authority ${parsedCert.name} not found</p>`
								});
							} 
							else if (!verifyAuth(parsedCert.cert, auth.cert)) {
								bootbox.alert({ 
									title: 'Error',
									message: `<p class="lead">Certificate not singed by stored authority ${parsedCert.name}</p>`
								});
							} else {
								storeCert(parsedCert);
							}
						});
					}
				} catch (err) {
					bootbox.alert({ 
						title: 'Error',
						message: 
								'<p class="lead">File not a valid X.509 Certificate</p>' +
								`<em>${err.message}</em>`
					});
				}
			};
			reader.readAsText(file);
		}
		// clear selected file
		$(this).val('');
	});

	// store a parsed cert object
	function storeCert(parsedCert) {
		storage.get(certType, result => {
			let items = result[certType];

			// check if common name already stored & allow to replace if so
			let storeFlag = true;
			if (typeof items === 'undefined') {
				items = [parsedCert];
			} else {
				const index = items.findIndex(e => e.name === parsedCert.name);
				if (index >= 0) {
					bootbox.confirm({
						message: `A certificate for ${parsedCert.name} already exists. Do you want to overwrite it?`,
						buttons: {
							confirm: {label: 'Yes', className: 'btn-success'},
							cancel: {label: 'No', className: 'btn-danger'}
						},
						callback: result => {
							if (result) items[index] = parsedCert;
							else storeFlag = false;
						}
					});
				} else {
					items.push(parsedCert);
				}
			}

			if (storeFlag) {
				storage.set({[certType]: items});
				// reload table
				selectCertTable(certType);
			}
		});
	}
}

////////////////////////////////////////////
//  Crypto util functions
////////////////////////////////////////////

// parse a x.509 cert
function parseCert(rawCert, rawReturn=true) {
	const asciiCert = rawCert.replace(/(-----(BEGIN|END)( NEW)? CERTIFICATE-----|\n)/g, '');
	const certBuffer = stringToArrayBuffer(atob(asciiCert));

	let asn1 = asn1js.fromBER(certBuffer);
	const cert = new Certificate({ schema: asn1.result });

	const subject = cert.subject.typesAndValues;
	const issuer = cert.issuer.typesAndValues;

	const commonName = getCertValueFromType(subject, 'CN');
	const issuerName = getCertValueFromType(issuer, 'CN');

	const serial = bufferToHexCodes(cert.serialNumber.valueBlock.valueHex);
	const beginOn = cert.notBefore.value.toString();
	const expireOn = cert.notAfter.value.toString();

	return {
		'name'  : commonName,
		'issuer': issuerName,
		'serial': serial,
		'begin' : beginOn,
		'expire': expireOn,
		'cert'  : rawReturn ? rawCert : cert
	};
}

// cert type IODs for subject and issuer
const typeIODs = {
	'C' : '2.5.4.6',
	'OU': '2.5.4.10',
	'O' : '2.5.4.11',
	'CN': '2.5.4.3',
	'L' : '2.5.4.7',
	'S' : '2.5.4.8',
	'T' : '2.5.4.12',
	'GN': '2.5.4.42',
	'I' : '2.5.4.43',
	'SN': '2.5.4.4',
	'E-mail' : '1.2.840.113549.1.9.1'
};

function getCertValueFromType(subject, type) {
	let typeIOD = typeIODs[type];
	if(typeof typeIODs === 'undefined') typeIOD = type;

	const typeValue = subject.find(e => e.type === typeIOD);

	if (typeof typeValue === 'undefined') return null;
	else return typeValue.value.valueBlock.value;
}

// parse a pkcs#8 cert
function parseKey(rawKey) {
	const asciiKey = rawKey.replace(/(-----(BEGIN|END)( NEW)? PRIVATE KEY-----|\n)/g, "");
	return asciiKey;
}

// check that the new cert was issued by claimed issuer
function verifyAuth(auth, cert) {
	// TODO: implement
	return true;
}