frappe.ui.form.on('Wiki Task', {
	// The board owns the UI; the form is only a fallback for the Desk.
	refresh(frm) {
		frm.trigger('set_status_color');
	},

	set_status_color(frm) {
		const colors = {
			Backlog: 'gray',
			'To Do': 'blue',
			'In Progress': 'orange',
			Done: 'green',
		};
		if (frm.doc.status) {
			frm.get_field('status').$wrapper
				.find('.indicator')
				.addClass(colors[frm.doc.status]);
		}
	},
});
