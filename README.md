# LFEST
Work for the Freight Compliance Unit to automate their periodic data processing and display the data in a user friendly dashboard.

<img src="https://github.com/aldrake87/LFEST/blob/master/FrontPagejpg.jpg">

This work has helped to familiarise myself with the world of JavaScript, HTML and CSS. Note that the dummy data has been provided due to the sensitive nature of the original. There is an R data-pipeline to wrangle the raw data (operator stops, congestion incidents, operator details and collision details) - this is not provided here again due to the nature of the data.

## CSS
I have taken advantage of [bootstrap](https://v4-alpha.getbootstrap.com/), [mdbootstrap](https://mdbootstrap.com/) and developed custom css where necessary.

## JavaScript
Other than the libraries required for Bootstrap/MDBootstrap, I have predominantly used [D3.js](https://d3js.org/) to manipulate the HTML the visualisations, using examples from the D3.js [examples](https://github.com/d3/d3/wiki/Gallery)). 

Table control is granted using [jQuery](https://jquery.com/) and [datatables](https://datatables.net/) and queue.js is used during the data import phase. Note that the latest version of d3.js (v5 at the time of writting) includes queue.js and so I have only included it here for legacy reason (dashboard uses d3.v3).

## HTML
HTML for the dashboard is shown in *index.html*. You can view the demo page here [https://alex-drake.github.io/LFEST/](https://alex-drake.github.io/LFEST/)
