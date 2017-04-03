// config
let storage = chrome.storage.local;

// TEST DATA
let testCerts = [
	{
		"name": "alice@example.com",
		"serial": "00:BF:8C:89:E5:E2:85:6E:0F",
		"begin": "31/03/17",
		"expire": "30/04/17"
	},
	{
		"name": "bob@example.com",
		"serial": "00:BF:8C:89:E5:E2:85:6E:0E",
		"begin": "31/03/17",
		"expire": "30/04/17"
	},
];

storage.set({'signature': testCerts});
storage.set({'encryption': testCerts});

// identifiers
const $table = $('#certTable');
const	$button = $('#deleteButton');

// variables
let certType;
let selections = [];

// Initialise table headers and data
const columns = [
	[{
		"field": "state",
		"checkbox": "true"
	},
	{
		"field": "name",
		"title": "Certificate Name",
	},
	{
		"field": "serial",
		"title": "Serial Number",
	}, {
		"field": "begin",
		"title": "Begins On",
	}, {
		"field": "expire",
		"title": "Expires On",
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
	})
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
		bootbox.confirm("Are you sure you want to delete these?", result => {
			if (true) {

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