//////////////////////////////////////////////////////////////////////////
///////////////////////// FCU JavaScript /////////////////////////
//////////////////////////////////////////////////////////////////////////

// fcu.js v3.0 (28/02/2018)

var uniqueList, allData, sortedData, satData, opCentres, operators, collisions, congestion, fcuAction;
var top50, usrSel;
var q = queue();

var selected;

///////////////////////////////////////////
/////////LOAD ALL DATA (START)/////////////
///////////////////////////////////////////
q.defer(d3.csv, "data/operatorCentres.csv")
	.defer(d3.csv,"data/processedData.csv")
	.defer(d3.csv,"data/collisions.csv")
	.defer(d3.csv,"data/congestion.csv")
	.defer(d3.csv,"data/fcuAction.csv")
	.await(prepData)
///////////////////////////////////////////
/////////LOAD ALL DATA (END)///////////////
///////////////////////////////////////////

///////////////////////////////////////////
/////////DATA PREPARATION (START)//////////
///////////////////////////////////////////

function prepData(error, opIn, dataIn, colin, conIn, actIn) {
	if(error){alert("Data Error");}
	
	allData = dataIn;
	opCentres = opIn;
	collisions = colin;
	congestion = conIn;
	fcuAction = actIn;
	
	// calculate total matrix score per operator based on licence numbers
	top50 = d3.nest().key(function(d) { return d.LicenceNumber; }).entries(opCentres);

	
	top50 = top50.filter(function(d) { return d.key !== "" || d.key !== "N/A"; });
	
	// rename columns	and add calculated columns
	top50.forEach(function(d){
			
			// get all stop data for each operator
			var result = allData.filter(function(allData) {
				return allData.opLicence == d.key;
			});
			
			// get operator name for each operator licence
			var opName = opCentres.filter(function(opCentres) {
				return opCentres.LicenceNumber == d.key;
			});
			
			// get collisions data for each operator licence
			var opCols = collisions.filter(function(collisions) {
				return collisions.Licence == d.key;
			});
			
			// get congestion data for each operator licence
			var opCon = congestion.filter(function(congestion) {
				return congestion.Licence == d.key;
			});
			
			d.Operator = (opName[0] !== undefined & opName[0]["OperatorName"] !== "NA") ? opName[0]["OperatorName"] : "UNKNOWN ("+d.key+")";
			d.Licence = d.key; // operator licence
			d.Score = d3.sum(result, function(g) { return g.matScore; });
			delete d.key;
			delete d.values;
			
			d["Industry Sector"] = (opName[0]["Industry"] !== undefined & opName[0]["Industry"] !== "NA") ? opName[0]["Industry"] : "Unknown";
			d["Total Stops"] = (result[0] !== undefined) ? result.filter(function(g) { return g.satStop ;}).length : 0;
			// calculated values //
			// Verbal warnings
			d["Verbal Warning only"] = d3.sum(result, function(g) { return g.vw; });
			//  unsatisfactory stops
			d["Unsatisfactory Stops"] = (result[0] !== undefined) ? result.filter(function(g) { return g.satStop == "No" && g.vw != 1 ;}).length : 0;
			// satisfactory stops
			d["Satisfactory Stops"] = (result[0] !== undefined) ? result.filter(function(g) { return g.satStop == "Yes" ;}).length : 0;
			// stops without verbal warnings
			d.woVW = (result[0] !== undefined) ? Math.round((d["Unsatisfactory Stops"] / d["Total Stops"]) * 100) : 0;
			// stops with verbal warnings
			d["Non-Compliance (%)"] = (result[0] !== undefined) ? Math.round(((d["Verbal Warning only"] + d["Unsatisfactory Stops"]) / d["Total Stops"]) * 100) : 0;
			
			// offence counts
			d["Display"] = d3.sum(result, function(g) { return g.disp; }); // display
			d["Driver Hours"] = d3.sum(result, function(g) { return g.hours; }); // drivers hours
			d["Dimensions"] = d3.sum(result, function(g) { return g.height; }); // overheight/width/length
			d["Licence Offences"] = d3.sum(result, function(g) { return g.lic; }); // licence offences
			d["Loading"] = d3.sum(result, function(g) { return g.load; }); // loading offences
			d["Moving"] = d3.sum(result, function(g) { return g.mov; }); // moving offences
			d["Vehicle Defects"] = d3.sum(result, function(g) { return g.veh; }); // vehicle defects
			d["Weight"] = d3.sum(result, function(g) { return g.wt; }); // overweight
			// total offences
			d["Offences"] = Math.round(d.Display + d["Driver Hours"] + d["Dimensions"] + d["Licence Offences"] + d["Loading"] + 
			d["Moving"] + d["Vehicle Defects"] + d["Weight"]);
			
			// additional values
			d.seize = d3.sum(result, function(g) { return g.seize; }); // vehicle seizures
			d.imP = d3.sum(result, function(g) { return g.imP; }); // immediate prohibitions
			d.dfP = d3.sum(result, function(g) { return g.dfP; }); // deferred prohibitions
			d.SLS = d3.sum(result, function(g) { return g.sls; }); // SLS scheme
			d.smns = d3.sum(result, function(g) { return g.smns; }); // Summons
			d.f1029 = d3.sum(result, function(g) { return g.f1029; }); // F1029 prohibitions
			
			// sanctions (for table)
			d.Sanctions = d.seize + d.imP + d.dfP + d.SLS + d.smns + d.f1029;
			
			// collisions
			d.Fatals = (opCols[0] !== undefined) ? d3.sum(opCols, function(g) { return g.Fatal; }) : 0; // fatal collisions
			d.Serious = (opCols[0] !== undefined) ? d3.sum(opCols, function(g) { return g.Serious; }) : 0; // serious collisions
			d["Minor Collisions"] = (opCols[0] !== undefined) ? d3.sum(opCols, function(g) { return g.Minor; }) : 0; // other collisions
			
			// congestion
			d["Congestion Issues"] = (opCon[0] !== undefined) ? d3.sum(opCon, function(g) { return g.Congestion; }) : 0; // breakdowns and load loss
			
		});
	
	// sort by matrix score
	top50 = top50.sort(function(a,b) {
		return d3.descending(a.Score, b.Score);
	});

	// build index page table (top50)
	var table_plot = makeTable()
							.datum(top50)
							.sortBy('Score', false)
							.filterCols(["Industry Sector","woVW","seize","imP","dfP","smns","f1029"]);
							
	d3.select('#container')
		.call(table_plot);
		
	// build initial pie chart
	change(refreshData(top50.filter(function(g) { return g.Operator == top50[0]["Operator"]; })));			
		
	//build company list
	var myList = d3.select("#fetchComps")
		
	var options = myList
		.append("select")
		.selectAll("option")
		.data(d3.map(top50, function(d) { return d.Operator;}).keys()).enter()
		.append("option")
		.text(function(d){return d;})
		.attr("value", function(d){return d;});
		
		// get default value (highest Matrix Score) and fill in form
		d3.select("select")
			.property("selected", function(g){
				selected = top50[0]["Operator"];
				fillPage(selected);
				// build new pie
				change(refreshData(top50.filter(function(g) { return g.Operator == selected; })));
				return g == selected;
			});
		
		// refine by user selected operator
		d3.select('select')
			.on("change", function() {
				selected = this.value;
				fillPage(this.value);
				change(refreshData(top50.filter(function(g) { return g.Operator == selected ;})));
			});
}

///////////////////////////////////////////
/////////DATA PREPARATION (END)////////////
///////////////////////////////////////////

function fillPage(d) {
	
	usrSel = d;
	
	// limit data to selected company (based on licence number)
	var usrData =  top50.filter(function(g) { return g.Operator == usrSel ;});		
	var pgData = allData.filter(function(d) { return d.opLicence == usrData[0]["Licence"] ;});
	
	// get unique license number (some typos - take first occurrence)
	var opLic = pgData.filter(function(d) { return d.opLicence !== "" ;});
	opLic = d3.map(opLic, function(d){ return d.opLicence;}).keys()[0];
	
	// if it doesn't exist in the filtered page data then we can use the user data instead (as we've had to bodge the way we create our operators list since the addition of collision and congestion data)
	if(opLic == undefined){
		opLic = usrData[0]["Licence"];
	}
	
	// get operator data from op centres data
	var myOp = opCentres.filter(function(d) { return d["LicenceNumber"] == opLic;});

	if(myOp.length == 0){
		myOp = [{"Directors": "No Data", "TransportManagers": "No Data", "VehiclesSpecified": "No Data", "Activation Year": "Unknown", "Industry": "Unknown"}];
	}
	
	// get action data from fcu action list (make it if it doesn't exist)
	var actionData = fcuAction.filter(function(d) { return d.Licence == opLic;});
	if(actionData.length == 0){
		actionData = [{"FCU Status": "Monitored", "LFEP Action History": "None", "Outcomes": "None"}];
	}
	
	// get collision data
	var colData = collisions.filter(function(d) { return d.Licence == opLic;});
	if(colData.length == 0){
		colData = [{"Date": "-", "VRM": "-", "Location": "-", "Borough": "-", "Manouvre": "No collisions recorded", "Involved": "-", "Fatal": "-",  "Serious": "-", "Minor": "-"}];
	}
	
	// get congestion data
	var conData = congestion.filter(function(d) { return d.Licence == opLic;});
	if(conData.length == 0){
		conData = [{"Date": "-", "VRM": "-", "Location": "-", "Borough": "-", "Hazard": "No congestion issues recorded"}];
	}

	// license number
	d3.select("#cellLic")
		.html(function(d){
			if(opLic == ""){
				return "No Data";
			} else {
				return opLic;
			}
		});
	
		// company director	
		d3.select("#CompDir").data(myOp).html(function(d){ return d.Directors; });
		
		// transport manager
		d3.select("#TransMng").data(myOp).html(function(d){ return d.TransportManagers; });
		
		// fleet size
		d3.select("#FltSz").data(myOp).html(function(d){ return d.VehiclesSpecified; });
		
		// Industry
		d3.select("#industryH").data(myOp).html(function(d){ return d["Industry"]; });		
		
		if(myOp.length > 0){
		// Op Address
		d3.select("#opAd")
		.data(myOp)
		.html(function(d){
			if(d.CorrespondenceAddress == ""){
				return "No Data";
			} else {
				return d.CorrespondenceAddress;
			}
		});				
		} else {
			d3.select("#opAd")
			.html("No Data");
		};
		
		// fcu status
		d3.select("#fcuAct").data(actionData).html(function(d){ return d["FCU Status"]; });
		
		// LFEP Action History
		d3.select("#lfepAct").data(actionData).html(function(d){ return d["LFEP Action History"]; });
		
		// Outcomes
		d3.select("#outcome").data(actionData).html(function(d){ return d["Outcomes"]; });
		
		// populate opCentre table
		opTable(myOp, ["addresses","BOROUGH","Sector","MPS CVU"], "t01");
		
		// populate stops table
		stopsTabs(pgData, ["date","officerBase","VRM","satStop","offences","matScore"]);
		
		// populate collisions table
		colsTabs(colData, ["Date","VRM","Location","Borough","Manouvre","Involved","Fatal","Serious","Minor"]);
		
		// populate congestion table
		conTabs(conData, ["Date","VRM","Location","Borough","Hazard"]);
		
		// populate sanctions table
		d3.select("#szImp").data(usrData).html(function(d){ return d.seize; });
		d3.select("#vehDef").data(usrData).html(function(d){ return d["Vehicle Defects"]; });
		d3.select("#imPro").data(usrData).html(function(d){ return d.imP; });
		d3.select("#drvHr").data(usrData).html(function(d){ return d["Driver Hours"]; });
		d3.select("#defPro").data(usrData).html(function(d){ return d.dfP; });
		d3.select("#insLd").data(usrData).html(function(d){ return d["Loading"]; });
		d3.select("#licOff").data(usrData).html(function(d){ return d["Licence Offences"]; });
		d3.select("#mtOff").data(usrData).html(function(d){ return d["Moving"]; });
		d3.select("#ohT").data(usrData).html(function(d){ return d["Dimensions"]; });
		d3.select("#sls").data(usrData).html(function(d){ return d.SLS; });
		d3.select("#f1029").data(usrData).html(function(d){ return d.f1029; });
		d3.select("#smns").data(usrData).html(function(d){ return d.smns; });
		
		// update stop summary table
		d3.select("#usStops").data(usrData).html(function(d){ return d["Unsatisfactory Stops"]; });
		d3.select("#vwStops").data(usrData).html(function(d){ return d["Verbal Warning only"]; });
		d3.select("#satStops").data(usrData).html(function(d){ return d["Satisfactory Stops"]; });
		d3.select("#totStops").data(usrData).html(function(d){ return d["Total Stops"]; });

		// total Matrix Score
		var matTot = usrData[0]["Score"]
		d3.select("#matrixScore").html(matTot);
		d3.select("#matBox")
			.attr("class", function(d) {
				if(matTot > 99){
			return "info-box danger";
				} else if(matTot > 79){
			return "info-box warning";
				} else {
			return "info-box success";
				}});
		
		// non-compliance without vw score
		var WOVW = usrData[0]["woVW"];
		d3.select("#compWOVW").html(WOVW + "%");
		d3.select("#wovwBox")
			.attr("class", function(d) {
				if(WOVW > 79){
			return "info-box danger";
				} else if(WOVW > 59){
			return "info-box warning";
				} else {
			return "info-box success";
				}});
		
		// non-compliance with vw score
		var WVW = usrData[0]["Non-Compliance (%)"];
		d3.select("#compWVW").html(WVW + "%");
		d3.select("#wvwBox")
			.attr("class", function(d) {
				if(WVW > 79){
			return "info-box danger";
				} else if(WVW > 59){
			return "info-box warning";
				} else {
			return "info-box success";
				}});
				
		// roads impact stats
		d3.select("#fatalVal").data(usrData).html(function(d){ return d.Fatals; });
		d3.select("#fatal")
			.attr("class", function(d) {
				if(usrData[0]["Fatals"] > 0){
					return "info-box danger";
				} else { return "info-box fcu"}
				});
		d3.select("#seriousVal").data(usrData).html(function(d){ return d.Serious; });
		d3.select("#serious")
			.attr("class", function(d) {
				if(usrData[0]["Serious"] > 0){
					return "info-box danger";
				} else { return "info-box fcu"}
				});
		d3.select("#otherVal").data(usrData).html(function(d){ return d["Minor Collisions"]; });
		d3.select("#congestionVal").data(usrData).html(function(d){ return d["Congestion Issues"]; });
}

// create op table with unique data, columns and table id
function opTable(data, columns, id) {
	var rem = d3.select("#opsTable").select("table").remove()
	var table = d3.select("#opsTable").append("table").attr("id", id)
	var thead = table.append("thead")
	var tbody = table.append("tbody");
	
	// append the header row
	thead.append("tr")
		.selectAll("th")
		.data(columns).enter()
		.append("th")
			.text(function (column) {return column; });
			
	// create a row for each object in the data
	var rows = tbody.selectAll("tr")
		.data(data)
		.enter()
		.append("tr");
		
	// create a cell in each row for each column
	var cells = rows.selectAll("td")
		.data(function (row) {
			return columns.map(function (column) {
				return {column: column, value: row[column]};
			});
		})
		.enter()
		.append("td")
			.text(function (d) { return d.value; });
			
	// rename columns
	thead.select("tr").remove();
	thead.append("tr")
		.selectAll("th")
		.data( ["Operator Centres","Borough","Sector","MPS CVU"]).enter()
		.append("th")
			.text(function(d) { return d; });		
			
	return table;
}

// create stops table
function stopsTabs(data, columns) {
	
	if(data.length == 0){
		data = [{"date": "-","officerBase": "-","VRM": "-","satStop": "-","offences": "No Stops Recorded","matScore": "-"}]
	}
	
	var rem = d3.select("#stpTable").select("table").remove()
	var table = d3.select("#stpTable").append("table").attr("id","stop")
	var thead = table.append("thead")
	var tbody = table.append("tbody");
	
	// stop details table
	thead.append("tr")
		.selectAll("th")
		.data(columns).enter()
		.append("th")
			.text(function(column) { return column; });
		
	// create a row for each object in the data
	var rows = tbody.selectAll("tr")
		.data(data)
		.enter()
		.append("tr");
		
	// create a cell in each row for each column
	var cells = rows.selectAll("td")
		.data(function (row) {
			return columns.map(function (column) {
				return {column: column, value: row[column]};
			});
		})
		.enter()
		.append("td")
			.html(function (d) { return d.value; });
	
	// sort table by date of stop
	table.selectAll("tbody tr")
		.sort(function(a, b) {
			var format = d3.time.format("%d/%m/%Y");
			return d3.ascending(format.parse(a["date"]), format.parse(b["date"]));
		});
	
	// rename columns
	thead.select("tr").remove();
	thead.append("tr")
		.selectAll("th")
		.data( ["Date","Unit","VRM","Satisfactory Stop","Offences","Matrix Score"]).enter()
		.append("th")
			.text(function(d) { return d; });
		
	return table;	
}

// create collisions table
function colsTabs(data, columns) {
	
	var rem = d3.select("#colTab").select("table").remove()
	var table = d3.select("#colTab").append("table").attr("class","rsiT")
	var thead = table.append("thead")
	var tbody = table.append("tbody");
	
	// stop details table
	thead.append("tr")
		.selectAll("th")
		.data(columns).enter()
		.append("th")
			.text(function(column) { return column; });
		
	// create a row for each object in the data
	var rows = tbody.selectAll("tr")
		.data(data)
		.enter()
		.append("tr");
		
	// create a cell in each row for each column
	var cells = rows.selectAll("td")
		.data(function (row) {
			return columns.map(function (column) {
				return {column: column, value: row[column]};
			});
		})
		.enter()
		.append("td")
			.html(function (d) { return d.value; });
	
	// sort table by date of stop
	table.selectAll("tbody tr")
		.sort(function(a, b) {
			var format = d3.time.format("%d/%m/%Y");
			return d3.ascending(format.parse(a["Date"]), format.parse(b["Date"]));
		});
	
	// rename columns
	thead.select("tr").remove();
	thead.append("tr")
		.selectAll("th")
		.data( ["Date","VRM","Location","Borough","Manoeuvre","Involved","Fatal","Serious","Minor"]).enter()
		.append("th")
			.text(function(d) { return d; });
		
	return table;	
}

// create congestion table
function conTabs(data, columns) {
	
	var rem = d3.select("#conTab").select("table").remove()
	var table = d3.select("#conTab").append("table").attr("class","rsiT")
	var thead = table.append("thead")
	var tbody = table.append("tbody");
	
	// stop details table
	thead.append("tr")
		.selectAll("th")
		.data(columns).enter()
		.append("th")
			.text(function(column) { return column; });
		
	// create a row for each object in the data
	var rows = tbody.selectAll("tr")
		.data(data)
		.enter()
		.append("tr");
		
	// create a cell in each row for each column
	var cells = rows.selectAll("td")
		.data(function (row) {
			return columns.map(function (column) {
				return {column: column, value: row[column]};
			});
		})
		.enter()
		.append("td")
			.html(function (d) { return d.value; });
	
	// sort table by date of stop
	table.selectAll("tbody tr")
		.sort(function(a, b) {
			var format = d3.time.format("%d/%m/%Y");
			return d3.ascending(format.parse(a["Date"]), format.parse(b["Date"]));
		});
	
	// rename columns
	thead.select("tr").remove();
	thead.append("tr")
		.selectAll("th")
		.data( ["Date","VRM","Location","Borough","Hazard"]).enter()
		.append("th")
			.text(function(d) { return d; });
		
	return table;	
}

//==========================//
// ==========pie chart ======== //
//==========================//	
// select element with id myPie
var svg = d3.select("#myPie")
	.append("svg")
	.append("g")

// append g with class slices, labels and lines
svg.append("g")
	.attr("class", "slices");
svg.append("g")
	.attr("class", "labels");
svg.append("g")
	.attr("class", "lines");

// set display size and pie size
var width = window.innerWidth * 0.25,
    height = window.innerHeight * 0.25,
	radius = Math.min(width, height) * 0.3;
	
// initiate pie
var pie = d3.layout.pie()
	.sort(null)
	.value(function(d) {
		return d.value;
	});

// define arc calculation
var arc = d3.svg.arc()
	.outerRadius(radius * 0.8)
	.innerRadius(radius * 0.4);

// define outer arc calculation
var outerArc = d3.svg.arc()
	.innerRadius(radius * 0.9)
	.outerRadius(radius * 0.9);

svg.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

var key = function(d){ return d.data.label; };

// define colour scale
var color = d3.scale.ordinal()
	.domain(["Unsatisfactory Stops", "Verbal Warning only", "Satisfactory Stops"])
	.range([ "#d32f2f", "#f57c00", "#388e3c"]);
	
// function to refresh data in pie chart
function refreshData(data){
	var labels = color.domain();
	return labels.map(function(label){
		return { label: label, value: data[0][label] }
	}).sort(function(a,b) {
		return d3.ascending(a.label, b.label);
	});
}

function mergeWithFirstEqualZero(first, second){
	var secondSet = d3.set(); second.forEach(function(d) { secondSet.add(d.label); });

	var onlyFirst = first
		.filter(function(d){ return !secondSet.has(d.label) })
		.map(function(d) { return {label: d.label, value: 0}; });
	return d3.merge([ second, onlyFirst ])
		.sort(function(a,b) {
			return d3.ascending(a.label, b.label);
		});
}

// function to activate and change pie chart contents
function change(data) {
	// change duration
	var duration = 1000;
	var data0 = svg.select(".slices").selectAll("path.slice")
		.data().map(function(d) { return d.data });
	if (data0.length == 0) data0 = data;
	var was = mergeWithFirstEqualZero(data, data0);
	var is = mergeWithFirstEqualZero(data0, data);

	/* ------- SLICE ARCS -------*/
	var slice = svg.select(".slices").selectAll("path.slice")
		.data(pie(was), key);

	// set slice colour
	slice.enter()
		.insert("path")
		.attr("class", "slice")
		.style("fill", function(d) { return color(d.data.label); })
		.each(function(d) {
			this._current = d;
		});

	slice = svg.select(".slices").selectAll("path.slice")
		.data(pie(is), key);
		
	slice		
		.transition().duration(duration)
		.attrTween("d", function(d) {
			var interpolate = d3.interpolate(this._current, d);
			var _this = this;
			return function(t) {
				_this._current = interpolate(t);
				return arc(_this._current);
			};
		});

	slice = svg.select(".slices").selectAll("path.slice")
		.data(pie(data), key);
	
	// remove old slice
	slice
		.exit().transition().delay(duration).duration(0)
		.remove();

	/* ------- TEXT LABELS -------*/
	var text = svg.select(".labels").selectAll("text")
		.data(pie(is), key);

	// create main label (ie name of data)
	text.enter()
		.append("text")
		.attr("dy", ".35em")
		.style("opacity", 0)
		.text(function(d) {
			return d.data.label;
		})
		.each(function(d) {
			
			this._current = d;
		});
		
	// remove any old tspan
	d3.select(".labels")	.selectAll("tspan").remove()
		
	// add tspan to show value (as can be unclear from pie alone)
	d3.select(".labels")	.selectAll("text").data(pie(is), key)
		.append("tspan").attr("dy","1.2em").attr("x",0)
		.text(function(d) { return "("+d.data.value+")"; });
	
	// calculate angle of mid-point
	function midAngle(d){
		return d.startAngle + (d.endAngle - d.startAngle)/2;
	}

	text = svg.select(".labels").selectAll("text")
		.data(pie(is), key);
		
	text.transition().duration(duration)
		.style("opacity", function(d) {
			return d.data.value == 0 ? 0 : 1;
		})
		.attrTween("transform", function(d) {
			var interpolate = d3.interpolate(this._current, d);
			var _this = this;
			return function(t) {
				var d2 = interpolate(t);
				_this._current = d2;
				var pos = outerArc.centroid(d2);
				pos[0] = radius * (midAngle(d2) < Math.PI ? 1 : -1);
				return "translate("+ pos +")";
			};
		})
		.styleTween("text-anchor", function(d){
			var interpolate = d3.interpolate(this._current, d);
			return function(t) {
				var d2 = interpolate(t);
				return midAngle(d2) < Math.PI ? "start":"end";
			};
		});
	
	text = svg.select(".labels").selectAll("text")
		.data(pie(data), key);

	text
		.exit().transition().delay(duration)
		.remove();

	/* ------- SLICE TO TEXT POLYLINES -------*/
	var polyline = svg.select(".lines").selectAll("polyline")
		.data(pie(was), key);
	
	polyline.enter()
		.append("polyline")
		.style("opacity", 0)
		.each(function(d) {
			this._current = d;
		});

	polyline = svg.select(".lines").selectAll("polyline")
		.data(pie(is), key);
	
	polyline.transition().duration(duration)
		.style("opacity", function(d) {
			return d.data.value == 0 ? 0 : .5;
		})
		.attrTween("points", function(d){
			this._current = this._current;
			var interpolate = d3.interpolate(this._current, d);
			var _this = this;
			return function(t) {
				var d2 = interpolate(t);
				_this._current = d2;
				var pos = outerArc.centroid(d2);
				pos[0] = radius * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);
				return [arc.centroid(d2), outerArc.centroid(d2), pos];
			};			
		});
	
	polyline = svg.select(".lines").selectAll("polyline")
		.data(pie(data), key);
	
	polyline
		.exit().transition().delay(duration)
		.remove();
};

// set view to home page (top 50 table only)
function homePg() {
	d3.select("#homePage").style("display","block");
	d3.select("#opsPage").style("display","none");		
}

// set view blank (for load)
function dropCover() {
	d3.select("#cover").style("display","none");
}

// set view to Operator Details
function opDetPg() {
	d3.select("#homePage").style("display","none");
	d3.select("#opsPage").style("display","block");	
	d3.select("#operatorDetails").style("display","block");
	d3.select("#stopDetails").style("display","none");
	d3.select("#opsTable").style("display","block");
	d3.select("#stpTable").style("display","none");
	d3.select("#rssDets").style("display","none");
	d3.select("#rssTable").style("display","none");
}

// set view to Operator Stop Summary Details
function opStpPg() {
	d3.select("#homePage").style("display","none");
	d3.select("#opsPage").style("display","block");	
	d3.select("#operatorDetails").style("display","none");
	d3.select("#stopDetails").style("display","block");
	d3.select("#opsTable").style("display","none");
	d3.select("#stpTable").style("display","block");
	d3.select("#rssDets").style("display","none");
	d3.select("#rssTable").style("display","none");
}

// set view to Roads Impact Details
function rssPg() {
	d3.select("#homePage").style("display","none");
	d3.select("#opsPage").style("display","block");	
	d3.select("#operatorDetails").style("display","none");
	d3.select("#stopDetails").style("display","none");
	d3.select("#opsTable").style("display","none");
	d3.select("#stpTable").style("display","none");
	d3.select("#rssDets").style("display","block");
	d3.select("#rssTable").style("display","block");
}

function makeTable() {
	var data, sort_by, filter_cols; // Customizable variables
	
	var table; // A reference to the main DataTable object
	
	// This is a custom event dispatcher.
	var dispatcher = d3.dispatch('highlight');
	
	// Main function, where the actual plotting takes place.
	function _table(targetDiv) {
	  // Create and select table skeleton
	  var tableSelect = targetDiv.append("table")
		.attr("class", "display compact")
	    .attr("id", "fcuTable") 
	    .style("visibility", "hidden"); // Hide table until style loads;
			
	  // Set column names
	  var colnames = Object.keys(data[0]);
		if(typeof filter_cols !== 'undefined'){
			// If we have filtered cols, remove them.
			colnames = colnames.filter(function (e) {
				return filter_cols.indexOf(e) < 0;
			});
		}
		
		// Here I initialize the table and head only. 
		// I will let DataTables handle the table body.
	  var headSelect = tableSelect.append("thead");
	  headSelect.append("tr")
	    .selectAll('td')
	    .data(colnames).enter()
		    .append('td')
		    .html(function(d) { return d; });
	
		if(typeof sort_by !== 'undefined'){
			// if we have a sort_by column, format it according to datatables.
			sort_by[0] = colnames.indexOf(sort_by[0]); //colname to col idx
			sort_by = [sort_by]; //wrap it in an array
		}		

	  // Apply DataTable formatting: https://www.datatables.net/
	  $(document).ready(function() {
	    table = $('#fcuTable').DataTable({
	      data: data,
	      columns: colnames.map(function(e) { 
				//console.log(e); // for checking column order
			  return {data: e}; 
			  }),
	      "bLengthChange": false, // Disable page size change
	      "bDeferRender": true,
	      "order": sort_by,
		  colReorder: {
			  order: [0,1,2,7,3,5,4,6,16,14,9,13,11,12,10,15,8,17,18,19,20,21,22]
			  },
		  dom: 'Bfrtip',
		  buttons: [
		  {
			  extend: 'csvHtml5',
			  text: 'Export CSV',
			  filename: 'fcu_data',
			  download: 'open'
		  },
		  'pageLength'
		  ],
		  lengthMenu: [
				[ 50, 100, 250, -1 ],
				['50', '100', '250', 'Show all']
				]
	    });
			
	    tableSelect.style("visibility", "visible");
		
      $('#fcuTable tbody')
        .on( 'mouseover', 'tr', function () { highlight(this, true); } )
        .on( 'mouseleave', 'tr', function () { highlight(this, false); } )
		.on('click', 'tr', function () { 
			opDetPg(); // switch pages			
			selected = table.row(this).data().Operator; // update selected value			
			fillPage(selected);	// fill in the page with selected company
			change(refreshData(top50.filter(function(g) { return g.Operator == selected; })));
			// make sure text on selected option is the same as what was clicked
			d3.select("#fetchComps")
				.selectAll("option")
				.property("selected", function(g) {
					return g == selected;
				});
		});
		
		homePg(); // set home page view ON
		dropCover(); // drop the mask/cover
	  });	
	}		
  
	/**** Helper functions to highlight and select data **************/
	function highlight(row, on_off) {
		if(typeof on_off === 'undefined'){
			// if on_off is not provided, just toggle class.
			on_off = !d3.select(row).classed('highlight');
		}
		// Set the row's class as highlighted if on==true,
		d3.select(row).classed('highlight', on_off);
		
		// Fire a highlight event, with the data and highlight status.
		dispatcher.highlight(table.rows(row).data()[0], on_off);
	}
	
	/**** Setter / getters functions to customize the table plot *****/
	_table.datum = function(_){
    if (!arguments.length) {return data;}
    data = _;
    
    return _table;
	};
	_table.filterCols = function(_){
    if (!arguments.length) {return filter_cols;}
    filter_cols = _;
    
    return _table;
	};
	_table.sortBy = function(colname, ascending){
    if (!arguments.length) {return sort_by;}
    
		sort_by = [];
		sort_by[0] = colname;
		sort_by[1] = ascending ? 'asc': 'desc';
    
    return _table;
	};	
	
	// This allows other objects to 'listen' to events dispatched by the _table object.
	d3.rebind(_table, dispatcher, 'on');
	
	// This is the return of the main function 'makeTable'
	return _table;
}
