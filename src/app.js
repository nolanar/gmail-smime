const loadOptions = {
	appName: 'Gmail S/MIME',
	appIconUrl: chrome.runtime.getURL('res/icon/icon-lock.png')
};
InboxSDK.load('1.0', 'sdk_gmail-smime_9187cbd76a', loadOptions).then(sdk => {

	sdk.Compose.registerComposeViewHandler(composeViewHandler);
	sdk.Conversations.registerMessageViewHandler(messageViewHandler);

});

// ComposeView.prototype.attachFile = blob => compView.attachFiles([blob]);

// action to take when a compose view is created
function composeViewHandler(composeView) {
	composeView.addButton({
		title: 'Sign and Encrypt',
		iconUrl: chrome.runtime.getURL('res/icon/icon-lock.png'),
		onClick: event => {
			const compView = event.composeView;
			// event.composeView.insertTextIntoBodyAtCursor('Hello World!');
			let subject = compView.getHTMLContent();
			let blob = new Blob([subject], {type: 'text/html'});
			blob.name = 'myfile.txt';
			// compView.setBodyText(subject);
			compView.attachInlineFiles([blob]);
		}
	});
}

// action to take when a message is opened
function messageViewHandler(composeView) {
	let attachments = composeView.getFileAttachmentCardViews();
	// console.log(attachments);
	let attach = attachments[0];

	attach.addButton({
		tooltip: 'Decrypt Message',
		iconUrl: chrome.runtime.getURL('icon-lock.png'),
		onClick: event => {
			event.getDownloadURL().then(url => {window.alert(url);});
		}
	});
}