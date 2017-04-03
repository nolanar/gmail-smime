
// Initialise table headers and data

let data = [{
	"name": "nolanar@tcd.ie",
	"counts": {
		"stargazers_count": "526",
		"forks_count": "122"
	},
}, {
	"name": "multiple-select",
	"counts": {
		"stargazers_count": "288",
		"forks_count": "150"
	}
}];
let columns = [
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
		data: data,
		columns: columns
	});
});

let selections = [];
let $table = $('#certTable');
let	$button = $('#deleteButton');

$(() => {
	$button.click(() => {
		let ids = $.map($table.bootstrapTable('getSelections'), row => {return row.name;});
		$table.bootstrapTable('remove', {field: 'name', values: ids});
	});

	$table.on('check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table', () => {
		console.log(!$table.bootstrapTable('getSelections').length);
		$button.prop('disabled', !$table.bootstrapTable('getSelections').length);
		// save your data, here just save the current page
		// selections = getIdSelections();
		// push or splice the selections if you want to save all data selections
	});
});
