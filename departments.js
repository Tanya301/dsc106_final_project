// Categorization function
function categorizeSurgery(opname) {
    const categories = {
        "Gastrointestinal": ["gastrectomy", "colectomy", "resection", "ileostomy", "colostomy", "esophagectomy", "pancreatectomy", "laparotomy", "fundoplication", "gastrostomy", "small bowel"],
        "Hepatobiliary": ["liver", "hepatectomy", "biliary", "choledochal", "hepaticojejunostomy", "pancreaticoduodenectomy"],
        "Thoracic": ["lung", "lobectomy", "pneumonectomy", "bronchoscopy", "thoracotomy", "thoracoplasty", "pleurectomy"],
        "Vascular": ["bypass", "endarterectomy", "fistula", "graft", "aneurysm", "artery", "vascular repair"],
        "Endocrine": ["thyroid", "parathyroid", "adrenalectomy", "pancreas transplantation"],
        "Urological": ["nephrectomy", "ureterectomy", "cystectomy", "prostatectomy", "pyeloplasty"],
        "Gynecological": ["hysterectomy", "oophorectomy", "salpingectomy", "myomectomy", "parametrectomy"],
        "Oncological": ["tumor", "metastasectomy", "radical", "lymph node dissection"],
        "Transplantation": ["transplantation", "donor", "organ transplant"],
        "Hernia Repair": ["hernia repair", "fistulectomy", "rectal prolapse operation"],
        "General Surgery": ["biopsy", "exploration", "debridement", "incision", "excision", "wound revision", "drainage", "closure", "removal of foreign body"]
    };

    opname = opname.toLowerCase();
    for (const category in categories) {
        if (categories[category].some(keyword => opname.includes(keyword))) {
            return category;
        }
    }
    return "Other";
}

// Load data and create stacked bar chart
d3.csv("cases.csv").then(function (data) {
    const departments = ["General surgery", "Thoracic surgery", "Urology", "Gynecology"];
    const filteredData = data.filter(d => departments.includes(d.department));

    // Process data
    const ageBins = Array.from({ length: 10 }, (_, i) => i * 10);
    const groupedData = {};

    filteredData.forEach(d => {
        const dept = d.department;
        const age = +d.age;
        const opnameCategory = categorizeSurgery(d.opname);
        const ageBin = Math.floor(age / 10) * 10;

        if (!groupedData[dept]) groupedData[dept] = {};
        if (!groupedData[dept][ageBin]) groupedData[dept][ageBin] = {};
        if (!groupedData[dept][ageBin][opnameCategory]) groupedData[dept][ageBin][opnameCategory] = 0;

        groupedData[dept][ageBin][opnameCategory]++;
    });

    // Convert groupedData into an array for D3 stacking
    const departmentData = Object.keys(groupedData).map(dept => {
        const ageBinsData = Object.keys(groupedData[dept]).map(ageBin => {
            let entry = { ageGroup: `Age ${ageBin}-${+ageBin + 9}` };
            Object.keys(groupedData[dept][ageBin]).forEach(category => {
                entry[category] = groupedData[dept][ageBin][category];
            });
            return entry;
        });
        return { department: dept, data: ageBinsData };
    });

    // Set up chart dimensions
    const width = 800, height = 500, margin = { top: 50, right: 30, bottom: 100, left: 60 };

    // Create SVG container
    const svg = d3.select("#barchart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Color scale
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Function to clear the previous chart content
    function clearChart() {
        svg.selectAll("*").remove();
    }

    // Function to draw stacked bar chart
    function drawStackedChart(departmentData) {
        d3.select("#legend").html(""); // Clear existing legend
        const data = departmentData.data;

        // Get all unique categories
        const allCategories = [...new Set(data.flatMap(d => Object.keys(d).filter(k => k !== "ageGroup")))];

        // Stack data
        const stack = d3.stack()
            .keys(allCategories)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone);

        const stackedData = stack(data);

        // X and Y scales
        const xScale = d3.scaleBand()
            .domain(data.map(d => d.ageGroup))
            .range([margin.left, width - margin.right])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d3.sum(allCategories, key => d[key] || 0))])
            .range([height - margin.bottom, margin.top]);

        // Clear previous chart content
        clearChart();

        // Append X-axis
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickSize(0));

        // Append Y-axis
        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(yScale));
        
        // Adding title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", margin.top)
            .attr("text-anchor", "middle")
            .style("font-size", "20px")
            .style("font-family", "sans-serif")
            .style("fill", "black")
            .text("Surgery Type by Age Group");

        // Draw stacks
        const groups = svg.selectAll(".layer")
            .data(stackedData)
            .enter().append("g")
            .attr("fill", d => colorScale(d.key));

        groups.selectAll("rect")
            .data(d => d)
            .enter().append("rect")
            .attr("x", d => xScale(d.data.ageGroup))
            .attr("y", d => yScale(d[1]))
            .attr("height", d => yScale(d[0]) - yScale(d[1]))
            .attr("width", xScale.bandwidth());

        // Create legend
        d3.select("#legend").html("");
        const legend = d3.select("#legend")
            .selectAll("div")
            .data(allCategories)
            .enter().append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("margin-bottom", "5px");

        legend.append("div")
            .style("width", "20px")
            .style("height", "20px")
            .style("background-color", d => colorScale(d))
            .style("margin-right", "5px");

        legend.append("span").text(d => d);

        


        // Show the back button
        d3.select("#backButton").style("display", "inline-block");
    }

    // Function to draw the initial department-level chart
    function drawDepartmentChart(departmentData) {
        d3.select("#legend").html(""); // Clear existing legend
        const xScale = d3.scaleBand()
            .domain(departmentData.map(d => d.department))
            .range([margin.left, width - margin.right])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(departmentData, d => d3.sum(d.data, d => d3.sum(Object.values(d).slice(1))))])
            .range([height - margin.bottom, margin.top]);

        // Clear previous chart content
        clearChart();

        svg.selectAll("rect")
            .data(departmentData)
            .enter().append("rect")
            .attr("x", d => xScale(d.department))
            .attr("y", d => yScale(d3.sum(d.data, d => d3.sum(Object.values(d).slice(1)))))
            .attr("width", xScale.bandwidth())
            .attr("height", d => height - margin.bottom - yScale(d3.sum(d.data, d => d3.sum(Object.values(d).slice(1)))))
            .attr("fill", "steelblue")
            .on("click", (_, d) => drawStackedChart(d));

        svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(xScale));
        svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(yScale));
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", margin.top)
            .attr("text-anchor", "middle")
            .style("font-size", "20px")
            .style("font-family", "sans-serif")
            .style("fill", "black")
            .text("Surgery Cases by Department");
        // Creating Legend
        const legend = d3.select("#legend")
            .selectAll("div")
            .data(departmentData.map(d => d.department))
            .enter().append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("margin-bottom", "5px");

        legend.append("div")
            .style("width", "20px")
            .style("height", "20px")
            .style("background-color", "steelblue")
            .style("margin-right", "5px");

        legend.append("span").text(d => d);

        

        // Hide the back button initially
        d3.select("#backButton").style("display", "none");
    }

    // Initially draw the department-level chart
    drawDepartmentChart(departmentData);

    // Back button click event to return to the main visualization
    d3.select("#backButton").on("click", function () {
        drawDepartmentChart(departmentData); // Reset to the department-level chart
    });
});
