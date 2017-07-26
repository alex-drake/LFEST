//alert("This is the test version");

var uniqueList, allData, sortedData, satData, opCentres;

mergedFiles = []
dates = []
var filesLen, unsat, sat, vw, exCodeData, top50, usrSel;
var q = queue();
var monthNames = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var monthComp = [0,1,2,3,4,5,6,7,8,9,10,11,0,1,2,3,4,5];
var today = new Date();
var offences = ["C&U Offence 1","C&U Offence 2","C&U Offence 3","C&U Offence 4","C&U Offence 5","C&U Offence 6","Drivers Hours Offence 1","Drivers Hours Offence 2","Drivers Hours Offence 3","Drivers Hours Offence 4","Drivers Hours Offence 5","Drivers Hours Offence 6","Tunnels Offence 1","Tunnels Offence 2"];
var sanctions = ["C&U Sanction 1","C&U Sanction 2","C&U Sanction 3","C&U Sanction 4","C&U Sanction 5","C&U Sanction 6","Drivers Hours Sanction 1","Drivers Hours Sanction 2","Drivers Hours Sanction 3","Drivers Hours Sanction 4","Drivers Hours Sanction 5","Drivers Hours Sanction 6"];

var mm = today.getMonth()+1;
var m = ("0" + mm).slice(-2);

var selected;

// set view to homePage
homePg();
	
///////////////////////////////////////////
/////////LOAD ALL DATA (START)/////////////
///////////////////////////////////////////
d3.csv("data/files.csv", function(data) {
	
	filesLen = data.length;
	for(var f=0; f<filesLen; f++) {
		q = q.defer(d3.csv, data[f].Files);
		if(data[f].Files.length == 18) {
			dates.push(data[f].Files.slice(8,14));
		}
	}
	q = q.defer(d3.csv, "data/codes.csv");
	q.await(prepData);
});

d3.csv("data/operatorCentres.csv", function(data) {

	opCentres = data;
	
});	
///////////////////////////////////////////
/////////LOAD ALL DATA (END)///////////////
///////////////////////////////////////////

///////////////////////////////////////////
/////////DATA PREPARATION (START)//////////
///////////////////////////////////////////

function prepData(error, colp1, colp2, colp3, colp4, colp5, colp6, mps1, mps2, mps3, mps4, mps5, mps6, codeData) {
	if(error) { alert("error"); }
	
	//merge data into a single array
	for(var a=1; a<arguments.length-1; a++) {
		arguments[a].forEach(function(d) {
			mergedFiles.push(d);
		});
	}
	
	//filter out unnecessary records
	allData = mergedFiles.filter(function(d) { return d["Vehicle Classification"] == "N2" || d["Vehicle Classification"] == "N3" || d["Vehicle Classification"] == "N3 (Cement mixer)" || d["Vehicle Classification"] == "N3 (Tipper)" || d["Vehicle Classification"] == "N3G (Tipper)" || d["Vehicle Classification"] == "Plant" || d["Vehicle Classification"] == "Plant (Volumetric)" });
	allData = allData.filter(function(d) { return d["O licence number"] != ""; });
	allData = allData.filter(function(d) { return d["O licence number"] != "N/A"; });
	allData = allData.filter(function(d) { return d["O licence number"] != "NA"; });
	allData = allData.filter(function(d) { return d["O licence number"] != "NO O LICENCE"; });
	exCodeData = codeData;

	//unique list of all companies (based on licence number)
	uniqueList = d3.map(allData, function(d) { return d["O licence number"];}).keys();
	
	for(var c=0; c<uniqueList.length; c++) {
		for(var a=0; a<allData.length; a++) {
			if(uniqueList[c] == allData[a]["O licence number"]) {
				var opName = allData[a]["Operator name"];
				uniqueList.push(opName);
			}
		}
	}	
	
	var mScore, mOffence;
	
	//loop through the offences in all records and look up the offence codes. Calculate the matrix score.
	for(var a=0; a<allData.length; a++) {
		mScore = 0;
		mOffence = "N/A";
		for(var o=0; o<offences.length; o++) {
			if(allData[a][offences[o]] != "") {
				for(var c=0; c<codeData.length; c++) {
					if(codeData[c].Code == allData[a][offences[o]] && parseInt(codeData[c]["Offence Score"]) != "NaN") {
						mScore = mScore + parseInt(codeData[c]["Offence Score"]) + sanction(allData[a][sanctions[o]]);
						mOffence == "N/A" ? mOffence = codeData[c].Offence : mOffence = mOffence + "; " + codeData[c].Offence;
					}
				}
			}
		}
		allData[a].matScore = mScore;
		allData[a].matOffence = mOffence;
		uniqueList.push(allData[a]);
	}
	
	// calculate total matrix score per operator based on licence numbers
	top50 = d3.nest()
		.key(function(d) { return d["O licence number"]; })
		.rollup(function(d) {
			return d3.sum(d, function(g) { return g.matScore; });
		}).entries(allData);
	
	top50 = top50.filter(function(d) { return d.key !== "" || d.key !== "N/A"; });
	
	// rename columns	and add calculated columns
	top50.forEach(function(d){
		
			d.Licence = d.key;
			d.Score = d.values;
			delete d.key;
			delete d.values;
			var result = allData.filter(function(allData) {
				return allData["O licence number"] == d.Licence;
			});
			
			// use melt function to flatten the returned data
			var molten = melt(result);
			molten = molten.filter(function(g) { return g.value != "" && (g.variable == "C&U Sanction 1" || g.variable == "C&U Sanction 2" || g.variable == "C&U Sanction 3" || g.variable == "C&U Sanction 4" || g.variable == "C&U Sanction 5" || g.variable == "C&U Sanction 6" || g.variable == "Drivers Hours Offence 1" || g.variable == "Drivers Hours Offence 2" || g.variable == "Drivers Hours Offence 3" || g.variable == "Drivers Hours Offence 4" || g.variable == "Drivers Hours Offence 5" || g.variable == "Drivers Hours Offence 6" || g.variable == "Tunnels Offence 1" || g.variable == "Tunnels Offence 2"); });
			
			// join to code data to get the offence type
			molten.forEach(function(g) {
				var res2 = exCodeData.filter(function(q) {
					return q.Code === g.value;
				});
				g.type = (res2[0] !== undefined) ? res2[0]["Offence Type"] : null;
			});
			
			d.Operator = (result[0] !== undefined) ? result[0]["Operator name"] : null;
			d["Industry Sector"] = (result[0] !== undefined) ? result[0]["Industry Sector"] : null;
			// calculated values
			d["Total VW Stops"] = (result[0] !== undefined) ? result.filter(function(g) { return g["C&U Sanction 1"] == "VW" ;}).length : null;
			d["Total US Stops"] = (result[0] !== undefined) ? result.filter(function(g) { return g["Satisfactory Stop"] == "No" && g["C&U Sanction 1"] != "VW" ;}).length : null;
			d["Total Sat Stops"] = (result[0] !== undefined) ? result.filter(function(g) { return g["Satisfactory Stop"] == "Yes" ;}).length : null;
			d["Total Stops"] = d["Total VW Stops"] + d["Total US Stops"] + d["Total Sat Stops"];
			d.woVW = Math.round((d["Total US Stops"] / d["Total Stops"]) * 100);
			d.wVW = Math.round(((d["Total VW Stops"] + d["Total US Stops"]) / d["Total Stops"]) * 100);
			
			// offence counts
			d.dispOff = (molten[0] !== undefined) ? molten.filter(function(g) { return g.type == "Display Offences";}).length : 0;
			d.drvHr = (molten[0] !== undefined) ? molten.filter(function(g) { return g.type == "Driver's Hours / Tachograph";}).length : 0;
			d.height = (molten[0] !== undefined) ? molten.filter(function(g) { return g.type == "Height / Length / Width";}).length : 0;
			d.licOff = (molten[0] !== undefined) ? molten.filter(function(g) { return g.type == "Licence Offences";}).length : 0;
			d.loadOff = (molten[0] !== undefined) ? molten.filter(function(g) { return g.type == "Loading Offences";}).length : 0;
			d.movOff = (molten[0] !== undefined) ? molten.filter(function(g) { return g.type == "Moving Traffic Offences";}).length : 0;
			d.vehDef = (molten[0] !== undefined) ? molten.filter(function(g) { return g.type == "Vehicle Defects";}).length : 0;
			d.wtOff = (molten[0] !== undefined) ? molten.filter(function(g) { return g.type == "Weight Offences";}).length : 0;
			d.totOff = Math.round(d.dispOff + d.drvHr + d.height + d.licOff + d.loadOff + d.movOff + d.vehDef + d.wtOff);
		});
	
	// sort by matrix score
	top50 = top50.sort(function(a,b) {
		return d3.descending(a.Score, b.Score);
	});
	
	// get search form input (if used)
	d3.select("#searchForm")
		.on("keyup", function() { // filter based on key pressed
			var searched_data = top50.slice(0,50);
			text = this.value.trim();
			
			// search for string anywhere in company name
			var searchResults = searched_data.map(function(r) {
				var regex = new RegExp(".*" + text + ".*", "i");
				if(regex.test(r.Operator)) { 
					return regex.exec(r.Operator)[0];
					}
			})
			
			// filter blank entries from the results
			searchResults = searchResults.filter(function(r) {
				return r != undefined;
			})

			// filter the data with searchResults
			searched_data = searchResults.map(function(r) {
				return searched_data.filter(function(p) {
					return p.Operator.indexOf(r) != -1;
				})
			})			
			// flatten the selected data
			searched_data = [].concat.apply([], searched_data)
			
			// rebuild the table
			indexTable(searched_data, ["Operator","Licence","Industry Sector","Score","Total Stops","Total US Stops","Total VW Stops","Total Sat Stops","totOff","dispOff","drvHr","height","licOff","loadOff","movOff","vehDef","wtOff"]);
		});	
	
	// build index page table (top50)
	indexTable(top50.slice(0,50), ["Operator","Licence","Industry Sector","Score","Total Stops","Total US Stops","Total VW Stops","Total Sat Stops","totOff","dispOff","drvHr","height","licOff","loadOff","movOff","vehDef","wtOff"]);
			
		
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
				return g == selected;
			});
		
		// refine by user selected operator
		d3.select('select')
			.on("change", function() {
				fillPage(this.value);
			});
			
		// watch for button clicks MATRIX SORT
		d3.select("#matSort")
			.on("click", function() {
				top50 = top50.sort(function(a,b) {
					return d3.descending(a.Score, b.Score);
					});
				indexTable(top50.slice(0,50), ["Operator","Licence","Industry Sector","Score","Total Stops","Total US Stops","Total VW Stops","Total Sat Stops","totOff","dispOff","drvHr","height","licOff","loadOff","movOff","vehDef","wtOff"]);
			});
		// watch for button clicks STOPS SORT
		d3.select("#stopSort")
			.on("click", function() {
				top50 = top50.sort(function(a,b) {
					return d3.descending(a["Total Stops"], b["Total Stops"]);
					});
				indexTable(top50.slice(0,50), ["Operator","Licence","Industry Sector","Score","Total Stops","Total US Stops","Total VW Stops","Total Sat Stops","totOff","dispOff","drvHr","height","licOff","loadOff","movOff","vehDef","wtOff"]);
			});
		// watch for button clicks OFFENCES SORT
		d3.select("#offSort")
			.on("click", function() {
				top50 = top50.sort(function(a,b) {
					return d3.descending(a.totOff, b.totOff);
					});
				indexTable(top50.slice(0,50), ["Operator","Licence","Industry Sector","Score","Total Stops","Total US Stops","Total VW Stops","Total Sat Stops","totOff","dispOff","drvHr","height","licOff","loadOff","movOff","vehDef","wtOff"]);
			});
}

///////////////////////////////////////////
/////////DATA PREPARATION (END)////////////
///////////////////////////////////////////

function fillPage(d) {
	
	usrSel = d;
	
	// limit data to selected company (based on licence number)
	var usrData =  top50.filter(function(g) { return g.Operator == usrSel ;});		
	var pgData = allData.filter(function(d) { return d["O licence number"] == usrData[0]["Licence"] ;});
	
	// get unique license number (some typos - take first occurrence)
	var opLic = pgData.filter(function(d) { return d["O licence number"] !== "" ;})
			opLic = d3.map(opLic, function(d){ return d["O licence number"];}).keys()[0];
	
	// license number
	d3.select("#cellLic")
		.data(pgData)
		.html(function(d){
			if(d["O licence number"] == ""){
				return "No Data";
			} else {
				return d["O licence number"];
			}
		});
	
	// company director	
	/*d3.select("#CompDir")
		.data(pgData)
		.html(function(d){
			if(d["O licence number"] == ""){
				return "No Data";
			} else {
				return d["O licence number"];
			}
		});*/
		
		// transport manager
		/*d3.select("#TransMng")
		.data(pgData)
		.html(function(d){
			if(d["O licence number"] == ""){
				return "No Data";
			} else {
				return d["O licence number"];
			}
		});*/
		
		// fleet size
		/*d3.select("#FltSz")
		.data(pgData)
		.html(function(d){
			if(d["O licence number"] == ""){
				return "No Data";
			} else {
				return d["O licence number"];
			}
		});*/
		
		// activation year
		/*d3.select("#ActYr")
		.data(pgData)
		.html(function(d){
			if(d["O licence number"] == ""){
				return "No Data";
			} else {
				return d["O licence number"];
			}
		});*/
		
		// OCRS TE
		d3.select("#OCRSTEA")
		.data(pgData)
		.html(function(d){
			if(d["OCRS TE"] == ""){
				return "No Data";
			} else {
				return d["OCRS TE"];
			}
		});
		
		// OCRS VE
		d3.select("#OCRSVEH")
		.data(pgData)
		.html(function(d){
			if(d["OCRS VE"] == ""){
				return "No Data";
			} else {
				return d["OCRS VE"];
			}
		});
		
		// FORS
		d3.select("#FORSH")
		.data(pgData)
		.html(function(d){
			if(d["FORS Stickers"] == ""){
				return "No Data";
			} else {
				return d["FORS Stickers"];
			}
		});
		
		// Industry
		d3.select("#industryH")
		.data(pgData)
		.html(function(d){
			if(d["Industry Sector"] == ""){
				return "No Data";
			} else {
				return d["Industry Sector"];
			}
		});
		
		// get operator data from op centres data
		var myOp = opCentres.filter(function(d) { return d["Licence Number"] == opLic;});
		
		if(myOp.length > 0){
		// Op Address
		d3.select("#opAd")
		.data(myOp)
		.html(function(d){
			if(d["Operator Address"] == ""){
				return "No Data";
			} else {
				return d["Operator Address"];
			}
		});				
		} else {
			d3.select("#opAd")
			.html("No Data");
		};
		
		// populate opCentre table
		opTable(myOp, ["Operating Centre","Borough","Sector","MPS CVU"], "t01");
		
		// populate stops table
		stopsTabs(pgData, ["Stop Date","Officer Base","VRM","Satisfactory Stop","matOffence","matScore"]);
		console.log(pgData)
		// populate sanctions table
		d3.select("#szImp").html(pgData.filter(function(d) { return d["Vehicle Seizure"] !== "" ;}).length);
		d3.select("#vehDef").data(usrData).html(function(d){ return d["vehDef"]; });
		d3.select("#imPro").html(pgData.filter(function(d) { return d["Prohibition Type - Unit"] == "DVSA PG9 (I)" ;}).length);
		d3.select("#drvHr").data(usrData).html(function(d){ return d["drvHr"]; });
		d3.select("#defPro").html(pgData.filter(function(d) { return d["Prohibition Type - Unit"] == "DVSA PG9 (D)" ;}).length);
		d3.select("#insLd").data(usrData).html(function(d){ return d["loadOff"]; });
		d3.select("#licOff").data(usrData).html(function(d){ return d["licOff"]; });
		d3.select("#mtOff").data(usrData).html(function(d){ return d["movOff"]; });
		d3.select("#ohT").data(usrData).html(function(d){ return d["height"]; });
		d3.select("#sls").html(pgData.filter(function(d) { return d["SLS Offence"] !== "N/A" ;}).length);
		
		// update stop summary table
		d3.select("#usStops").data(usrData).html(function(d){ return d["Total US Stops"]; });
		d3.select("#vwStops").data(usrData).html(function(d){ return d["Total VW Stops"]; });
		d3.select("#satStops").data(usrData).html(function(d){ return d["Total Sat Stops"]; });
		d3.select("#totStops").data(usrData).html(function(d){ return d["Total Stops"]; });
		
		// total Matrix Score
		var matTot = usrData[0]["Score"]
		d3.select("#matrixScore").html(matTot);
		if(matTot > 99){
			d3.select("#matBox").attr("class","info-box danger");
		} else if(matTot > 79){
			d3.select("#matBox").attr("class","info-box warning");
		} else {
			d3.select("#matBox").attr("class","info-box success")
		}
		
		// non-compliance without vw score
		var WOVW = usrData[0]["woVW"];
		d3.select("#compWOVW").html(WOVW + "%");
		if(WOVW > 79){
			d3.select("#wovwBox").attr("class","info-box danger");
		} else if(WOVW > 59){
			d3.select("#wovwBox").attr("class","info-box warning");
		} else {
			d3.select("#wovwBox").attr("class","info-box success")
		}
		
		// non-compliance with vw score
		var WVW = usrData[0]["wVW"];
		d3.select("#compWVW").html(WVW + "%");
		if(WVW > 79){
			d3.select("#wvwBox").attr("class","info-box danger");
		} else if(WVW > 59){
			d3.select("#wvwBox").attr("class","info-box warning");
		} else {
			d3.select("#wvwBox").attr("class","info-box success")
		}
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
	return table;
}

// create stops table
function stopsTabs(data, columns) {
	
	var rem = d3.select("#stpTable").select("table").remove()
	var table = d3.select("#stpTable").append("table").attr("id","t01")
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
			.text(function (d) { return d.value; });
	
	// sort table by date of stop
	table.selectAll("tbody tr")
		.sort(function(a, b) {
			var format = d3.time.format("%d/%m/%Y");
			return d3.ascending(format.parse(a["Stop Date"]), format.parse(b["Stop Date"]));
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

//lookup information for sanction scores
function sanction(x) {

	switch(x.toUpperCase()) {
		case "SEIZURE", "ARREST":
			return 15;
			break;
		case "PG9(I)", "POLICE PG9", "DRIVERS HOURS PROHIBITION":
			return 12;
			break;
		case "PG9(D)", "F1029":
			return 4;
			break;
		case "FPN", "GFPN", "ROADSIDE DEPOSIT", "SUMMONS", "TOR":
			return 6;
			break;
		default:
			return 0;
	}
}

// index table
function indexTable(data, columns){
	var rem = d3.select("#indexTable").select("table").remove()
	var table = d3.select("#indexTable").append("table").attr("id","index")
	var thead = table.append("thead")
	var tbody = table.append("tbody");
	
	// stop details table
	thead.append("tr")
		.selectAll("th")
		.data(columns).enter()
		.append("th")
			.text(function(column) { return column; });
	
	// create a row for each object in the data and add in click through feature to populate operator page
	var rows = tbody.selectAll("tr")
		.data(data)
		.enter()
		.append("tr")
		.on("click", function(d) {
			opDetPg(); // switch pages			
			selected = d.Operator; // update selected value			
			fillPage(selected);	// fill in the page with selected company
			
			// make sure text on selected option is the same as what was clicked
			d3.select("#fetchComps")
				.selectAll("option")
				.property("selected", function(g) {
					return g == selected;
				});
		});
		
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
		.data(["Operator","Licence","Industry Sector","Matrix Score","Total Stops","Total US Stops", "Total VW Stops","Total Sat Stops","Offences","Display","Driver Hours","Height / Length / Width","Licence","Loading","Moving","Vehicle Defects","Weight"]).enter()
		.append("th")
			.text(function(d) { return d; });	

	// select specific columns and append class (for switching columns)
	table.selectAll("th:nth-child(n+6):nth-child(-n+8)")
		.attr("class", "age");
	table.selectAll("th:nth-child(n+10):nth-child(-n+17)")
		.attr("class", "score");
		
	// select specific columns and append class (for switching columns)
	table.selectAll("td:nth-child(n+6):nth-child(-n+8)")
		.attr("class", "age");
	table.selectAll("td:nth-child(n+10):nth-child(-n+17)")
		.attr("class", "score");	
	
	// select specific column and add in attribute for function and id	
	table.select("th:nth-child(n+5)")
		.attr("id","grpChkBox1");		
	table.select("th:nth-child(n+9)")
		.attr("id","grpChkBox2");
	
	// select specific column and add in font-awesome icon
	table.select("th:nth-child(n+5)")
		.append("i")
		.attr("id","grp1arr")
		.attr("class","fa fa-angle-down fa-lg")
		.attr("aria-hidden","true");		
	table.select("th:nth-child(n+9)")
		.append("i")
		.attr("id","grp2arr")
		.attr("class","fa fa-angle-down fa-lg")
		.attr("aria-hidden","true");		
	
	// select header and change style (background colour) depending on data shown
	table.selectAll("th:nth-child(n+5):nth-child(-n+8)")
		.style("background-color","#8EB4E3")
		.style("border-color","#8EB4E3");	
	table.selectAll("th:nth-child(n+9):nth-child(-n+17)")
		.style("background-color", "#97B953")
		.style("border-color", "#97B953");
	
	// center align columns with numbers
	table.selectAll("th:nth-child(n+4):nth-child(-n+17)")
		.style("text-align","center");
	table.selectAll("td:nth-child(n+4):nth-child(-n+17)")
		.style("text-align","center");
		
	// toggle stops columns
		$("#grpChkBox1").click(function(){
			$(".age").toggle();
			$("#grp1arr").toggleClass("fa fa-angle-down fa fa-angle-right");
		});
	// toggle offences columns
		$("#grpChkBox2").click(function(){
			$(".score").toggle();
			$("#grp2arr").toggleClass("fa fa-angle-down fa fa-angle-right");
		});
	
	// default setting to have columns hidden!
	$(".age").toggle();
	$("#grp1arr").toggleClass("fa fa-angle-down fa fa-angle-right");
	$(".score").toggle();
	$("#grp2arr").toggleClass("fa fa-angle-down fa fa-angle-right");
	
	return table;	
}

// set view to home page (top 50 table only)
function homePg() {
	d3.select("#homePage").style("display","block");
	d3.select("#opsPage").style("display","none");		
}

// set view to Operator Details
function opDetPg() {
	d3.select("#homePage").style("display","none");
	d3.select("#opsPage").style("display","block");	
	d3.select("#operatorDetails").style("display","block");
	d3.select("#stopDetails").style("display","none");
	d3.select("#opsTable").style("display","block");
	d3.select("#stpTable").style("display","none");
}

// set view to Operator Stop Summary Details
function opStpPg() {
	d3.select("#homePage").style("display","none");
	d3.select("#opsPage").style("display","block");	
	d3.select("#operatorDetails").style("display","none");
	d3.select("#stopDetails").style("display","block");
	d3.select("#opsTable").style("display","none");
	d3.select("#stpTable").style("display","block");
}
