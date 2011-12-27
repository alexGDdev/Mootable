/**
*
* Based on :
*
* @file mootable.js
* @author Mark Fabrizio Jr.
* @date January 24, 2007
*
* MooTable class takes an existing table as an argument and turns it into a cooler table.
* MooTables allow headings to be resized as well as sorted.
*
** @modified by L'ami Nuscule for better cross-browser compatibility (mainly for Safari2)
* @date Oct. 11, 2007
*
** @modified by Alex @ Globaldizajn.hr
* @date Oct. 20, 2007
*
*
* Added : - protected in options (will not allow columns to be hidden)
* 		  - saving columns settings in Cookies (size and visibility)
* 		  - reworked sorting system, implemented from Stuart Langridge, changed sorting with dates to accept dd/mm/yyyy
* 		  - MooTable only supports from now creating table from table, results in much quicker rendering time for larger tables (speed improvement is noticable with row count over 50)
* 		  - you can choose order of columns in display menu (top right corner of the table)
*		  - added 5/14/08 by Jordan Ehrlich (KU) to allow sortable columns parameter
*		  - added decimal option to choose decimal separator sign, defaults to .
* last update 2008-05-16
*/

var MooTable = new Class({

	initialize: function( el, options ){
		this.element = $(el);
		this.klon = $(el).clone();
		//this.klon.rows[0].remove();
		this.options = Object.extend(
			{
				height: '90%',
				resizable: false,
				sortable: '',
				useloading: true,
				position: 'inside',
				section: 20,
				delay: 10,
				fade: false,
				headers: false,
				data: false,
				protected: '',
				debug: false,
				footer: false,
				filter: [],
				minColWidth: 50,
				decimal:'.'
			} , options || {} );

		/* set up our reference arrays */
		this.headers = [];
		this.rows = [];
		this.rows = this.klon.getElements("tr");
		this.fade = this.options.fade ? (window.ie6 ? '' : '<div class="fade"></div>') : '';
		this.minSizes = [];
		this.colSortOrder = [];
		this.curSortOrder = [];

		/* initalize variables */
		this.loading = true;
		this.sortasc=true;
		this.sortby=false;
		this.sortby2=false;
		this.sortColumnIndex = "";
		this.sortables = {};
		//HANDLE COOKIES
		this.visibleColumnList = this._getVisibleColumnsCookie();

		this.addEvent( 'buildFinish', function(){

			if (this.klon.rows.length>0){

				if(this.options.footer) this.rows[this.rows.length-1].className += "sortbottom";

				//sort Cols
				this.colSortOrder = this._getOrderCookie()!="" ? this._getOrderCookie().split(",") :  [];
				if (this.colSortOrder.length>0) this.orderCols();
				//hide columns
				this._hideVisibleColumns();

				this._setColumnWidthsKlon();
				//apply zebra
				this._zebra();

				$$("input.filter_field").each(function(el){
					el.addEvent("keyup", function(){
					    for(i=1;i<this.klon.rows.length;i++){
						    if(el.value!=""){
								if(this.klon.rows[i].cells[el.id].innerHTML.indexOf(el.value)==-1) {
									this.klon.rows[i].setStyle("display", "none")
								}
								else if(this.klon.rows[i].getStyle("display")=="none"){
                                    this.klon.rows[i].setStyle("display", "")
								}
								
							}
							else{
                                this.klon.rows[i].setStyle("display", "")
							}
						}
						this._zebra();

					}.bind(this))
				}.bind(this))

				//calculate widths
				//this._setColumnWidthsKlon();
				//sort rows
				if (this.options.sortable && Cookie.get(document.location.search.replace(/=/g,'')+this.element.id)) {
					this.ts_resortTable(Cookie.get(document.location.search.replace(/=/g,'')+this.element.id));
				}

			}

		});

		if( this.options.debug ){
			this.debug = {};
			//debug.log('debug: on');
			this.addEvent( 'buildStart', function(){
				this.debug.startTime = new Date().getTime();
			});
			this.addEvent( 'buildFinish', function(){
				//console.log( 'build: '+ ( (new Date().getTime() - this.debug.startTime ) / 1000 ) + ' seconds' );
			});
			this.addEvent( 'sortStart', function(){
				this.debug.sortStart = new Date().getTime();
			});
			this.addEvent( 'sortFinish', function(){
				//console.log( 'sort: '+ ( (new Date().getTime() - this.debug.sortStart ) / 1000 ) + ' seconds' );
			});
		}
		if( this.options.useloading ){
			this.addEvent( 'loadingStart', function(){
				this.tbody.setStyle('overflow', 'hidden');
				this.tbodyloading.setStyle('display', 'block');
			});

			this.addEvent( 'loadingFinish', function(){
				this.tbody.setStyle('overflow', 'auto');
				this.tbodyloading.setStyle('display', 'none');
			});
		}


		//calculate minimal col width
		this._minSizes();

		/* create the table */
		this._makeTable(this.element);


		this.div.setStyle('height', this.options.height );
		this._manageHeight();
		this.tbody.addEvent('scroll', function(event){
			this.thead_tr.setStyle( 'left', '-'+this.tbody.scrollLeft+'px' );
			return true;
		}.bind(this));
		this._initDisplayOptions();
		//HANDLE COOKIES

	},

	_minSizes:function(){
		//find the min size of each cell
		if(this.klon.rows.length<2) return;
		//set id for row width control
		this.klon.rows[0].id = "controlRowWidth";
		this.klon.addClass("klonPadding");
		this.minSizes = [];
		
		if (this.options.fade){
            for(var i=0;i<this.klon.rows.length;i++){
				for(var j=0;j<this.klon.rows[i].cells.length;j++){
					this.klon.rows[i].cells[j].innerHTML = "<div class='cell'><span style='display:block'>" + this.klon.rows[i].cells[j].innerHTML + "</span><div class='fade'>&nbsp;</div></div>";
				}
			}
			for(var i=0;i<this.klon.rows[1].cells.length;i++){
				this.minSizes.push(this.options.minColWidth);
			}
		}
		else{
		
			for(var i=0;i<this.klon.rows[0].cells.length;i++){
				//remove header
				//this.element.rows[0].style.display="none";
				//find out min size of each cell by setting width 1
				this.element.rows[0].cells[i].setAttribute("width",1);
				var w = (this.element.rows[0].cells[i].clientWidth>this.options.minColWidth) ? this.element.rows[0].cells[i].clientWidth+5 : this.options.minColWidth;
				this.minSizes.push(w);
			}
		}
	},

	_replaceCols:function(col1, col2){
		$$("#" + this.klon.id + " tr").each(function(el){
			var tmp = "";
			tmp = el.cells[col1].innerHTML;
			el.cells[col1].innerHTML = el.cells[col2].innerHTML;
			el.cells[col2].innerHTML = tmp;
		});
		/*
		tmp = $$("div.th")[col1].innerHTML;
		$$("div.th")[col1].innerHTML = $$("div.th")[col2].innerHTML;
		$$("div.th")[col2].innerHTML = tmp;
		*/
		var tmp = $$("div.th")[col1].firstChild.innerHTML;
		$$("div.th")[col1].firstChild.empty().innerHTML = $$("div.th")[col2].firstChild.innerHTML;
		$$("div.th")[col2].firstChild.empty().innerHTML = tmp;


		var tmp = this.minSizes[col1];
		this.minSizes[col1] = this.minSizes[col2];
		this.minSizes[col2] = tmp;


		var tmp = $("controlRowWidth").cells[col1].style.width;
		$("controlRowWidth").cells[col1].style.width = $("controlRowWidth").cells[col2].style.width;
		$("controlRowWidth").cells[col2].style.width = tmp;
	},

	orderCols:function(){
		var alreadySorted = [];
		if (this.curSortOrder.length<1){
			for(var x=0;x<this.colSortOrder.length;x++){
				this.curSortOrder.push(x);
			}
		}
		this.colSortOrder.each(function(el, i){
			if(el) {
				if(this.curSortOrder[i]!=el){

					for(var j=0;j<this.curSortOrder.length;j++){
						if(this.curSortOrder[j]==el){
							this.curSortOrder[j] = this.curSortOrder[i];
							this.curSortOrder[i] = el;

							this._replaceCols(i, j);
							break;
						}
					}
				}
			};
		}.bind(this));

		this.curSortOrder = this.colSortOrder.slice();

		this._setOrderCookie(this.curSortOrder);

		//this._minSizes();

		this._setColumnWidthsKlon();
		this._setHeaderWidthsKlon();
	},

	_hideVisibleColumns:function(){
		//hides previously hidden Columns
		var visibleColumnList = this.visibleColumnList;

		for(i=0;i<visibleColumnList.length;i++){
			if(visibleColumnList[i]!=""){
				for (var x=0;x<this.klon.rows.length;x++){
					this.klon.rows[x].cells[visibleColumnList[i]].style.display = "none";
				}
				this.headers[visibleColumnList[i]].element.setStyle('display', 'none');

			}
		}

		if(visibleColumnList.length>0){
			this._setHeaderTableWidth();
			this._setDataTableWidth();
			this._setColumnWidthsKlon();
		}
	},

	_manageHeight: function(){
		var offset = this.options.resizable ? 8 : 1;
		this.tbody.setStyle('height', (this.div.getSize().size.y - this.thead.getSize().size.y - offset ) + 'px' );
		if( this.options.useloading ){
			this.tbodyloading.setStyle('height', (this.div.getSize().size.y - this.thead.getSize().size.y - offset)  + 'px' );
		}
		this.tbody.setStyle('top', this.thead.getSize().size.y + 'px' );

	},
	_rememberCookies: function(){
		this.headers.each( function( header ){
			var width = this._getWidthCookie( header.element )
			if( width ){
				header.element.setStyle('width', width );
				this._changeColumnWidth( header.element );
			}
		}, this );
	},

	_makeTable: function(el){
		this._fireEvent('buildStart');
		if( !el ){
			return;
		}
		this._createTableFramework();
		if( el.getTag() == 'table'){
			this._fireEvent('loadingStart');
			this._makeTableFromTable( el );

			return;
		}
		this.div.inject( el, this.options.position );
		this._build();
	},

	_makeTableFromTable: function(t,count){

		var rows = $type(t) == 'array' ? t : t.getElements('tr');
		if( !$chk(count) ) count = 0;
		while( count < 1 ){
			var tr = rows[count];
			if( count == 0 ){

				tr.setStyle('display', 'none');
				this.div.injectBefore(t);

				this.klon.injectInside(this.tbody);
				t.setStyle('display', 'none');

				if(t.getElement('tfoot')) t.getElement('tfoot').remove();
				tr.getElementsBySelector('th,td').each( function( th ){
					value = th.innerHTML; 
					if(this.options.sortable.length>0)
					{
						if(this.options.sortable.indexOf(value)!=-1)
							this._addHeader(value);
						else
							this._addHeader(value, {sortable: false});
					}
					else
						this._addHeader(value);
				}, this);
			}
			count++;

			this.element.remove();
		}

		this.loading = false;
		this._setHeaderTableWidth();
		this._setDataTableWidth();
		this._fireEvent('buildFinish');
		this._fireEvent('loadingFinish');
	},

	_build: function(){
		if( this.options.headers && $type(this.options.headers) == 'array'){
			this.options.headers.each( function( h ){
				switch( $type( h ) ){
					case 'string':
						this._addHeader( h.trim()=='' ? '&nbsp;' : h );
						break;

					case 'object':
						this._addHeader( h.text || '&nbsp;', h );
						break;

					default:
						break;
				}
			},this );
		}
		/* do a little cleanup to keep this object reasonable */
		this.options.headers = null;

	},

	_emptyData: function(){
		this.rows.each( function(row){
			row.element.remove();
		});
		this.rows = [];

	},

	_createTableFramework: function(){
		this.div = new Element('div').addClass('mootable_container');
		this.mootable = new Element('div').addClass( 'mootable' ).injectInside( this.div );
		this.thead = new Element('div').addClass('thead').injectInside( this.mootable );
		this.thead_tr = new Element('div').addClass('tr').injectInside( this.thead );
		this.tbody = new Element('div').addClass('tbody').injectAfter( this.thead );
		this.table = new Element('table').setProperties({cellpadding: '0', cellspacing: '0', border: '0'}).injectInside(this.tbody);
		this.tablebody = new Element('tbody').injectInside( this.table );
		if( this.options.useloading ){
			this.tbodyloading = new Element('div').addClass('loading').injectInside( this.tbody );
			this.tbodyloading.setStyle('opacity', '.84');
		}
		if( this.options.resizable ){
			this.resizehandle = new Element('div').addClass('resizehandle').injectInside(this.div);
			new Drag.Base( this.div, {
				handle: this.resizehandle,
				modifiers: {y: 'height'},
				onComplete: function(){
					this._manageHeight();
				}.bind(this)
			});
		}
	},

	_addHeader: function( value, opts ){
		var options = Object.extend({
			fixedWidth: false,
			defaultWidth: '50px',
			sortable: true,
			key: null,
			fade: true
		}, opts || {} );
		var cell = new Element('div').injectInside( this.thead_tr ).addClass('th');
		new Element('div').addClass('cell').setHTML( value ).injectInside( cell );
		
		if(this.options.filter.length!=0){
			var filterDiv = new Element('div').setStyle('overflow','hidden');
			new Element('input').setProperty('type','text').setProperty('id',this.headers.length).setProperty('class','filter_field').injectInside(filterDiv);
			filterDiv.injectInside(cell);
		}
		
		var h = {
			element: cell,
			value: value,
			options: options
		};
		h.element.col = this.headers.length;
		this.headers.push( h );
		var width = this._getWidthCookie( h.element ) ? this._getWidthCookie( h.element ) : this.minSizes[h.element.col];
		if (width<this.minSizes[h.element.col]) width = this.minSizes[h.element.col];

		if( width && !h.options.fixedWidth ){
			h.element.setStyle('width', width );
		}else{
			h.element.setStyle('width', h.options.defaultWidth );
		}

		h.width = h.element.getStyle('width');

		if( this.options.sortable && h.options.sortable ){
			h.element.addClass('sortable');
			h.element.addEvent('mouseup', function(ev){
				if (ev.className.indexOf("dragging")==-1){
					this.ts_resortTable( h.element.col );
				}
			}.pass(h.element, this));
		}

		if( !h.options.fixedWidth ){
			var handle = new Element('div').addClass('resize').injectInside( h.element );
			handle.setHTML('&nbsp;');
			var resizer = new Drag.Base(h.element, {
				handle: handle,
				limit: {y:[0,0], x:[20,200]},
				modifiers:{x: 'width'},
				onComplete: function(){
					//allow header resize only to min size of cell
					if( h.element.getSize().size.x < this.minSizes[h.element.col] ) {
						//console.log(h.element.col + " " + this.minSizes[h.element.col] + " " + h.element.getSize().size.x)
						h.element.setStyle('width', this.minSizes[h.element.col]);
						//console.log("onComplete");
						//this._setHeaderWidth();
					}
					this._setWidthCookie( h.element );
					this._setColumnWidthsKlon();

					this.thead.removeClass('dragging');
					h.element.removeClass('dragging');
				}.bind(this),

				onStart: function(ele){
					if( this.options.sortable) this.dragging = true;
					this.thead.addClass('dragging');
					ele.addClass('dragging');
				}.bind(this),

				onDrag: function(ele){
					//console.log("onDrag");
					this._setHeaderTableWidth();
				}.bind(this)
			} );
			// best fit
			handle.addEvent('dblclick', this.bestFit.pass( h.element.col,this) );

		}
		h.element.addEvent('mouseover', function(){
			this.addClass('mouseover');
		});
		h.element.addEvent('mouseout', function(){
			this.removeClass('mouseover');
		});
	},

	_setHeaderWidthsKlon: function(){
		$$("div.th").each(function(el, i){
			w = $("controlRowWidth").cells[i].style.width;
			el.setStyle("width", w);
		}.bind(this));
		this._setHeaderTableWidth();
		this._setDataTableWidth();
	},

	_setColumnWidthsKlon: function(){
		if( this.klon.rows.length > 0 ){
			$(this.klon.id).getElements('td[style^=width]').each( function( el ){
				 el.style.width = "";
			});
			/*
			for(i=0;i<this.headers.length;i++){
				var w = this.headers[i].element.style.width;
				w = window.ie ? (parseInt(w.replace(/px/,""))) : w; //+'px'

				if(w<this.minSizes[i]) w = this.minSizes[i];
				$("controlRowWidth").cells[i].style.width = w;
			}
			*/
			$$("div.th").each(function(el, i){
				w = el.getStyle("width");
				//w = window.ie ? (parseInt(w.replace(/px/,""))) : w; //+'px'
				if(w.replace(/px/,"")<this.minSizes[i]) w = this.minSizes[i];
				$("controlRowWidth").cells[i].style.width = w;
			}.bind(this));


		}
		//console.log("setColumnWidthsKlon");
		this._setHeaderTableWidth();
		this._setDataTableWidth();
	},

	_setHeaderTableWidth: function(){
		var width=0;
		$$("div.th").each(function(el, i){
			width += el.getStyle('display')=='none' ? 0 : el.getSize().size.x;
		}.bind(this));
		this.thead_tr.setStyle('width', width);
	},

	_setDataTableWidth: function(){
		this.klon.setStyle( 'width', this.thead_tr.getStyle("width"));
		this.tbody.fireEvent('scroll');
	},

	_initDisplayOptions: function(){
		this.displayOptions = new Element('div').addClass('mootable_options');
		//temp storage for sortables
		var sortablesList = new Element('div').setProperty('id', 'sortablesList').setStyle("display","none").injectInside(this.displayOptions);

		sortablesList.addEvent("change", function(el){
			this.colSortOrder = sortablesList.innerHTML.split(",");
			this.visibleColumnList.length = 0;
			$$('input[name^=mootable_h]').each(function(el, i){
				el.setProperty('sort', i);
				if(!el.getProperty('checked'))	this.visibleColumnList.push(i);
			}.bind(this));
			this._setVisibleColumnsCookie(this.visibleColumnList);
			this.orderCols();
		}.bind(this));

		this.form = new Element('form').setProperty('id', 'display_forma').injectInside( this.displayOptions );
		var i=0;
		var sortable_index = 0;
		//this.headers.each( function( header, indx){
		this.curSortOrder = [];
		for(var indx = 0;indx<this.headers.length;indx++){
			if (this.colSortOrder.length>indx){
				sortable_index = this.colSortOrder[indx];
			}
			else{
				sortable_index = indx;
			}
			var header = this.headers[sortable_index];
			var id = 'mootable_h'+sortable_index;

			var newDiv = new Element('div').setProperty('id', sortable_index).injectInside(this.form);
			//hide from list if it's protected column
			if (header){
				if (this.options.protected.indexOf(header.value)!=-1){
					newDiv.setStyle("display", "none");
				}


				var checkbox = new Element('input').setProperty('type','checkbox').setProperty('id',id).setProperty('sort', indx).setProperty('name',id).injectInside(newDiv);
				checkbox.setProperty('checked', true);


				if(this.visibleColumnList.contains(""+indx+"")) {
					checkbox.setProperty('checked', false);
				}

				checkbox.addEvent('click', this.toggleColumn.pass($(id),this) );
				var label = new Element('label').setProperty('for',id).setProperty('htmlFor',id).setHTML(header.value).injectInside(newDiv);

				if( i < this.headers.length ){
					new Element('br').injectAfter(label);
				}

				this.curSortOrder.push(sortable_index);
			}
		//}, this);
		}



		this.displayOptionsTrigger = new Element('div').addClass('displayTrigger').injectInside( this.thead );
		this.displayOptionsTrigger.addEvent('click', this._toggleDisplayOptions.bind(this) );

		this.displayOptions.addClass('displayOptions').injectAfter( this.displayOptionsTrigger );


		//enable sortables on display form
		this.sortables = new Sortables($('display_forma'), {

				initialize: function(){
					var step = 0;
					this.options.snap = 10;
					this.elements.each(function(element, i){
						element.addClass("sortables_bg");

					});
				},
				snap	: 3,
				ghost	: true,
				handles	: 'div label',
				onComplete : function(){
						$("sortablesList").empty();
						this.serialize(function(element) {
		                        $("sortablesList").innerHTML += element.id + ",";
		                    });
						$("sortablesList").fireEvent("change");
				}
			});

	},


	toggleColumn: function( col ){
		col = new Event(col);
		col = col.target.getProperty('sort');
		if(this.colSortOrder.length>col) {
			var checked = this.form['mootable_h'+this.colSortOrder[col]].checked;
		}
		else{
			var checked = this.form['mootable_h'+col].checked;
		}
		for (var i=0;i<this.klon.rows.length;i++){
			//alert(col + " " + this.klon.rows[i].cells.length);
			this.klon.rows[i].cells[col].style.display = checked ? '' : 'none'; //setStyle('display', checked ? '' : 'none');
		}

		//HANDLE COOKIES
		if(checked) {
			this.visibleColumnList.remove(""+col+"");
		}
		else{
			if(!this.visibleColumnList.contains(""+col+"")) this.visibleColumnList.include(col);
		}
		this._setVisibleColumnsCookie(this.visibleColumnList);

		this.headers[col].element.setStyle('display', checked ? '' : 'none');
		//console.log("toggleColumn");
		this._setHeaderTableWidth();
		this._setDataTableWidth();
		//this._setWidths();
	},
	_toggleDisplayOptions: function(ev){
		if( this.displayOptions.getStyle('display') == 'none' ){
			this.displayOptions.setStyle('display', 'block');
			document.addEvent('mousemove', this._monitorDisplayOptions.bind(this) );
		}
		else{
			this.displayOptions.setStyle('display', 'none');
			document.removeEvent( 'mousemove', this._monitorDisplayOptions );
		}
	},
	_monitorDisplayOptions: function(ev){
		var e = new Event( ev );
		var pos = this.displayOptions.getCoordinates();
		if( e.page.x < pos.left || e.page.x > (pos.left + pos.width) ){
			this.displayOptions.setStyle('display', 'none');
			document.removeEvent( 'mousemove', this._monitorDisplayOptions );
		}
		else if( e.page.y < pos.top || e.page.y > (pos.top + pos.height) ){
			this.displayOptions.setStyle('display', 'none');
			document.removeEvent( 'mousemove', this._monitorDisplayOptions );
		}
	},
	_zebra: function(){
		var c = 0;
		var cnt = 0;
		var table_rows = this.options.footer ? this.klon.rows.length-1 : this.klon.rows.length;
		for(c=0;c<table_rows;c++){
		    if(this.klon.rows[c].getStyle("display")!="none"){
                this.klon.rows[c].addClass( cnt%2 == 0 ? 'odd' : 'even' );
				this.klon.rows[c].removeClass( cnt%2 == 1 ? 'odd' : 'even' );
				this.klon.rows[c].addEvent("click",function(event){
				    event = new Event(event);
				    $$("tr.sel").each(function(el){
						el.removeClass("sel");
					})
				    this.addClass("sel");
				});
				cnt++
			}

		};
	},
	//HANDLE COOKIES
	// - remembers settings for each table by table ID
	_setWidthCookie: function( ele ){
		Cookie.set('mootable_h_'+this.element.id+'_'+document.location.pathname.replace(/=/g,'')+'_'+ele.col , ele.getStyle('width'), {duration: 365} );
	},
	_getWidthCookie: function( ele ){
		return Cookie.get('mootable_h_'+this.element.id+'_'+document.location.pathname.replace(/=/g,'')+'_'+ele.col);
	},
	_setOrderCookie: function( ele ){
		Cookie.set('mootable_order_'+this.element.id+'_'+document.location.pathname.replace(/=/g,''), ele, {duration: 365} );
	},
	_getOrderCookie: function( ele ){
		return Cookie.get('mootable_order_'+this.element.id+'_'+document.location.pathname.replace(/=/g,''));
	},
	// - remembers settings of visible columns for each table by table ID
	_setVisibleColumnsCookie: function( visibleColumnList ){
		Cookie.set('mootable_v_'+this.element.id+'_'+document.location.pathname.replace(/=/g,''), visibleColumnList, {duration: 365} );
	},
	_getVisibleColumnsCookie: function( ele ){
		var columnList = Cookie.get('mootable_v_'+this.element.id+'_'+document.location.pathname.replace(/=/g,''));
		columnList = columnList ? columnList.split(",") : [];
		return columnList
	},
	//HANDLE COOKIES


	ts_resortTable: function(col) {
		this._fireEvent('sortStart');

		this.sortColumnIndex = col;
	    // get the span
	    var span;

		var cnt = 0;
	    $$("div.th").each(function(el){
			if(cnt==col) span = el;
			cnt++;
		})

	    var spantext = this.ts_getInnerText(span);

	    //var table = this.klone;

	    // Work out a type for the column
	    if (this.rows.length <= 1) return;
	    var itm = this.ts_getInnerText(this.rows[1].cells[col]);
		//itm = itm.replace(new RegExp(/\./g),'');
	    sortfn = this.ts_sort_caseinsensitive;
	    var tmpNum = itm.replace(/\./g, "");
	    tmpNum = tmpNum.replace(",", ".");

	    if (itm.match(/^[£$]/)) sortfn = this.ts_sort_currency;
	    if (itm.match(/^[\d\.]+$/)) sortfn = this.ts_sort_numeric;
		if(parseFloat(tmpNum)) sortfn = this.ts_sort_numeric;
		if (itm.match(/[a-z]./i)) sortfn = this.ts_sort_caseinsensitive;
		if (itm.match(/^\d\d[\/-]\d\d[\/-]\d?\d?\d\d$/)) sortfn = this.ts_sort_date;
	    if (itm.match(/^\d?\d[\/.]\d?\d[\/.]\d\d\d\d$/)) sortfn = this.ts_sort_date;


	    var firstRow = new Array();
	    var newRows = new Array();
	    for (i=0;i<this.rows[1].length;i++) { firstRow[i] = this.rows[1][i]; }

	    //var table_rows = this.options.footer ? this.rows.length-1 : this.rows.length;
	    for (j=1;j<this.rows.length;j++) { newRows[j-1] = this.rows[j]; }



		Cookie.set(document.location.search.replace(/=/g,'')+this.element.id , this.sortColumnIndex, {duration:365});

		newRows.sort(sortfn.bind(this));

		var sortDir = parseInt(Cookie.get(document.location.search.replace(/=/g,'')+this.element.id+'dir'));
		//var sortDir
//		this.headers[this.sortby].element.addClass( 'sorted_'+ (this.sortasc ? 'asc' : 'desc' ) );

		var sort_dir = span.className ? span.className.indexOf('sorted_asc') : -1;
		if (sortDir) sort_dir = sortDir;
	    if (sort_dir>-1) {
	        newRows.reverse();
	        Cookie.set(document.location.search.replace(/=/g,'')+this.element.id+'dir' , -1, {duration:365});
	        var remove_dir = "sorted_asc";
	        span.className = span.className + ' sorted_desc';
	        span.className = span.className.replace('sorted_asc', '');
	    } else {
	    	var remove_dir = "sorted_desc";
	      	span.className = span.className + ' sorted_asc';
	        span.className = span.className.replace('sorted_desc', '');
	        Cookie.set(document.location.search.replace(/=/g,'')+this.element.id+'dir' , 1, {duration:365});
	    }

   		// Delete any other arrows there may be showing
		$$("div.th").each(function(el, ind){
			if(ind!=col){
				el.removeClass("sorted_asc");
				el.removeClass("sorted_desc");
			}

		})


	    // We appendChild rows that already exist to the tbody, so it moves them rather than creating new ones
	    // don't do sortbottom rows
	    for (i=0;i<newRows.length;i++) {
			if (!newRows[i].className || (newRows[i].className && (newRows[i].className.indexOf('sortbottom') == -1)))
				this.klon.tBodies[0].appendChild(newRows[i]);
		}
	    // do sortbottom rows only
	    for (i=0;i<newRows.length;i++) {
			if (newRows[i].className && (newRows[i].className.indexOf('sortbottom') != -1))
				this.klon.tBodies[0].appendChild(newRows[i]);
		}

		//this._setColumnWidthsKlon();
		this._zebra();
		this._fireEvent('sortFinish');
	},

	ts_sort_date: function (a,b) {
	    // y2k notes: two digit years less than 50 are treated as 20XX, greater than 50 are treated as 19XX
	    aa = this.ts_getInnerText(a.cells[this.sortColumnIndex]);
	    bb = this.ts_getInnerText(b.cells[this.sortColumnIndex]);

	    var arr = aa.split(".");
	    if (arr[1]<10) arr[1] = "0"+arr[1];
		if (arr[0]<10) arr[0] = "0"+arr[0];
		dt1 = arr[2] + arr[1] + arr[0];

		var brr = bb.split(".");
	    if (brr[1]<10) brr[1] = "0"+brr[1];
		if (brr[0]<10) brr[0] = "0"+brr[0];
		dt2 = brr[2] + brr[1] + brr[0];

	    if (dt1==dt2) return 0;
	    if (dt1<dt2) return -1;
	    return 1;
	},

	ts_sort_currency: function (a,b) {
	    aa = this.ts_getInnerText(a.cells[this.sortColumnIndex]).replace(/[^0-9.]/g,'');
	    bb = this.ts_getInnerText(b.cells[this.sortColumnIndex]).replace(/[^0-9.]/g,'');
	    return parseFloat(aa) - parseFloat(bb);
	},

	ts_sort_numeric : function (a,b) {
		
		if (this.options.decimal==",") {
		    aa = this.ts_getInnerText(a.cells[this.sortColumnIndex]).replace(/\./g,'');
			aa = parseFloat(aa.replace(/\,/g,'.'));
			
			bb = this.ts_getInnerText(b.cells[this.sortColumnIndex]).replace(/\./g,'');
			bb = parseFloat(bb.replace(/\,/g,'.'));
		}
		else{
			aa=a;
			bb=b;
			
		}
		
	    if (isNaN(aa)) aa = 0;
	    if (isNaN(bb)) bb = 0;
	    
		return aa-bb;

	},

	ts_sort_caseinsensitive : function (a,b) {
	    aa = this.ts_getInnerText(a.cells[this.sortColumnIndex]).toLowerCase();
	    bb = this.ts_getInnerText(b.cells[this.sortColumnIndex]).toLowerCase();
	    if (aa==bb) return 0;
	    if (aa<bb) return -1;
	    return 1;
	},

	ts_sort_default : function (a,b) {
	    aa = ts_getInnerText(a.cells[this.sortColumnIndex]);
	    bb = ts_getInnerText(b.cells[this.sortColumnIndex]);
	    if (aa==bb) return 0;
	    if (aa<bb) return -1;
	    return 1;
	},

	ts_getInnerText : function (el) {
		if (typeof el == "string") return el;
		if (typeof el == "undefined") { return "" };
		if (el.value) return el.value;	//Not needed but it is faster
		var str = "";

		var cs = el.childNodes;
		var l = cs.length;
		for (var i = 0; i < l; i++) {
			switch (cs[i].nodeType) {
				case 1: //ELEMENT_NODE
					str += this.ts_getInnerText(cs[i]);
					break;
				case 3:	//TEXT_NODE
					str += cs[i].nodeValue;
					break;
			}
		}
		return str;
	},

	bestFit: function(col){
		var max = 0;
		$$("#" + this.klon.id +" tr").each( function( el ){
			var cell = 0;
			for (var i=0;i<el.cells.length;i++){
				if (col==cell){
					s = el.cells[i].clientWidth;
					if( s > max ) max = s;
					//break;

				}
				cell++;

			}
		});
		if(col){
			this.headers[col].element.setStyle('width', (max+(this.headers[col].options.fade && this.options.fade ? 5 : 0)) + 'px' );
			this._setWidthCookie( this.headers[col].element );
		}
		this._setHeaderTableWidth();
		this._setColumnWidthsKlon();

	},

	addEvent: function(type, fn){
		this.events = this.events || {};
		this.events[type] = this.events[type] || {'keys': []};
		if (!this.events[type].keys.test(fn)){
			this.events[type].keys.push(fn);
		}
		return this;
	},


	_fireEvent: function(type,args){
		if (this.events && this.events[type]){
			this.events[type].keys.each(function(fn){
				fn.bind(this, args)();
			}, this);
		}
	}
});

