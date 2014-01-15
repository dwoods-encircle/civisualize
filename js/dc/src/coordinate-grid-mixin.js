/**
## Coordinate Grid Mixin

Includes: [Color Mixin](#color-mixin), [Margin Mixin](#margin-mixin), [Base Mixin](#base-mixin)

Coordinate Grid is an abstract base chart designed to support a number of coordinate grid based concrete chart types,
i.e. bar chart, line chart, and bubble chart.

**/
dc.coordinateGridMixin = function (_chart) {
    var GRID_LINE_CLASS = "grid-line";
    var HORIZONTAL_CLASS = "horizontal";
    var VERTICAL_CLASS = "vertical";
    var Y_AXIS_LABEL_CLASS = 'y-axis-label';
    var X_AXIS_LABEL_CLASS = 'x-axis-label';
    var DEFAULT_AXIS_LABEL_PADDING = 12;

    _chart = dc.colorMixin(dc.marginMixin(dc.baseMixin(_chart)));

    _chart.colors(d3.scale.category10());
    _chart._mandatoryAttributes().push('x');

    var _parent;
    var _g;
    var _chartBodyG;

    var _x;
    var _xOriginalDomain;
    var _xAxis = d3.svg.axis().orient("bottom");
    var _xUnits = dc.units.integers;
    var _xAxisPadding = 0;
    var _xElasticity = false;
    var _xAxisLabel;
    var _xAxisLabelPadding = 0;

    var _y;
    var _yAxis = d3.svg.axis().orient("left");
    var _yAxisPadding = 0;
    var _yElasticity = false;
    var _yAxisLabel;
    var _yAxisLabelPadding = 0;

    var _brush = d3.svg.brush();
    var _brushOn = true;
    var _round;

    var _renderHorizontalGridLine = false;
    var _renderVerticalGridLine = false;

    var _refocused = false;
    var _unitCount;

    var _zoomScale = [1, Infinity];
    var _zoomOutRestrict = true;

    var _zoom = d3.behavior.zoom().on("zoom", zoomHandler);
    var _nullZoom = d3.behavior.zoom().on("zoom", null);
    var _hasBeenMouseZoomable = false;

    var _rangeChart;
    var _focusChart;

    var _mouseZoomable = false;
    var _clipPadding = 0;

    var _outerRangeBandPadding = 0.5;
    var _rangeBandPadding = 0;

    var _useRightYAxis = false;

    _chart.rescale = function () {
        _unitCount = undefined;
    };

    /**
    #### .rangeChart([chart])
    Get or set the range selection chart associated with this instance. Setting the range selection chart using this function
    will automatically update its selection brush when the current chart zooms in. In return the given range chart will also
    automatically attach this chart as its focus chart hence zoom in when range brush updates. See the
    [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/) example for this effect in action.

    **/
    _chart.rangeChart = function (_) {
        if (!arguments.length) return _rangeChart;
        _rangeChart = _;
        _rangeChart.focusChart(_chart);
        return _chart;
    };

    /**
    #### .zoomScale([extent])
    Get or set the scale extent for mouse zooms.

    **/
    _chart.zoomScale = function (_) {
        if (!arguments.length) return _zoomScale;
        _zoomScale = _;
        return _chart;
    };

    /**
    #### .zoomOutRestrict([true/false])
    Get or set the zoom restriction for the chart. If true limits the zoom to origional domain of the chart.
    **/
    _chart.zoomOutRestrict = function (r) {
        if (!arguments.length) return _zoomOutRestrict;
        _zoomScale[0] = r ? 1 : 0;
        _zoomOutRestrict = r;
        return _chart;
    };

    _chart._generateG = function (parent) {
        if (parent === undefined)
            _parent = _chart.svg();
        else
            _parent = parent;

        _g = _parent.append("g");

        _chartBodyG = _g.append("g").attr("class", "chart-body")
            .attr("transform", "translate(" + _chart.margins().left + ", " + _chart.margins().top + ")")
            .attr("clip-path", "url(#" + getClipPathId() + ")");

        return _g;
    };

    /**
    #### .g([gElement])
    Get or set the root g element. This method is usually used to retrieve the g element in order to overlay custom svg drawing
    programatically. **Caution**: The root g element is usually generated by dc.js internals, and resetting it might produce unpredictable result.

    **/
    _chart.g = function (_) {
        if (!arguments.length) return _g;
        _g = _;
        return _chart;
    };

    /**
    #### .mouseZoomable([boolean])
    Set or get mouse zoom capability flag (default: false). When turned on the chart will be zoomable through mouse wheel
     . If range selector chart is also attached zooming will also update the range selection brush on associated range
     selector chart.

    **/
    _chart.mouseZoomable = function (z) {
        if (!arguments.length) return _mouseZoomable;
        _mouseZoomable = z;
        return _chart;
    };

    /**
    #### .chartBodyG()
    Retreive the svg group for the chart body.
    **/
    _chart.chartBodyG = function (_) {
        if (!arguments.length) return _chartBodyG;
        _chartBodyG = _;
        return _chart;
    };

    /**
    #### .x([xScale]) - **mandatory**
    Get or set the x scale. x scale could be any [d3 quatitive scales](https://github.com/mbostock/d3/wiki/Quantitative-Scales).
    For example a time scale for histogram or a linear/ordinal scale for visualizing data distribution.
    ```js
    // set x to a linear scale
    chart.x(d3.scale.linear().domain([-2500, 2500]))
    // set x to a time scale to generate histogram
    chart.x(d3.time.scale().domain([new Date(1985, 0, 1), new Date(2012, 11, 31)]))
    ```

    **/
    _chart.x = function (_) {
        if (!arguments.length) return _x;
        _x = _;
        _xOriginalDomain = _x.domain();
        return _chart;
    };

    _chart.xOriginalDomain = function () {
        return _xOriginalDomain;
    };

    /**
    #### .xUnits([xUnits function])
    Set or get the xUnits function. xUnits function is the coordinate grid chart uses to calculate number of data
    projections on x axis such as number bars for a bar chart and number of dots for a line chart. This function is
    expected to return an Javascript array of all data points on x axis. d3 time range functions d3.time.days, d3.time.months,
    and d3.time.years are all valid xUnits function. dc.js also provides a few units function, see [Utilities](#util)
    section for a list of built-in units functions. Default xUnits function is dc.units.integers.
    ```js
    // set x units to day for a histogram
    chart.xUnits(d3.time.days);
    // set x units to month for a histogram
    chart.xUnits(d3.time.months);
    ```
    Custom xUnits function can be easily created using as long as it follows the following inteface:
    ```js
    // units in integer
    function(start, end, xDomain) {
        // simply calculates how many integers in the domain
        return Math.abs(end - start);
    };

    // fixed units
    function(start, end, xDomain) {
        // be aware using fixed units will disable the focus/zoom ability on the chart
        return 1000;
    };
    ```

    **/
    _chart.xUnits = function (_) {
        if (!arguments.length) return _xUnits;
        _xUnits = _;
        return _chart;
    };

    /**
    #### .xAxis([xAxis])
    Set or get the x axis used by a particular coordinate grid chart instance. This function is most useful when certain x
    axis customization is required. x axis in dc.js is simply an instance of
    [d3 axis object](https://github.com/mbostock/d3/wiki/SVG-Axes#wiki-_axis) therefore it supports any valid d3 axis
    manipulation. **Caution**: The x axis is typically generated by dc chart internal, resetting it might cause unexpected
    outcome.
    ```js
    // customize x axis tick format
    chart.xAxis().tickFormat(function(v) {return v + "%";});
    // customize x axis tick values
    chart.xAxis().tickValues([0, 100, 200, 300]);
    ```

    **/
    _chart.xAxis = function (_) {
        if (!arguments.length) return _xAxis;
        _xAxis = _;
        return _chart;
    };

    /**
    #### .elasticX([boolean])
    Turn on/off elastic x axis. If x axis elasticity is turned on, then the grid chart will attempt to generate and
    recalculate x axis range whenever redraw event is triggered.

    **/
    _chart.elasticX = function (_) {
        if (!arguments.length) return _xElasticity;
        _xElasticity = _;
        return _chart;
    };

    /**
    #### .xAxisPadding([padding])
    Set or get x axis padding when elastic x axis is turned on. The padding will be added to both end of the x axis if and
    only if elasticX is turned on otherwise it will be simply ignored.

    * padding - could be integer or percentage in string (e.g. "10%"). Padding can be applied to number or date.
    When padding with date, integer represents number of days being padded while percentage string will be treated
    as number.

    **/
    _chart.xAxisPadding = function (_) {
        if (!arguments.length) return _xAxisPadding;
        _xAxisPadding = _;
        return _chart;
    };

    /**
    #### .xUnitCount()
    Returns the number of units displayed on the x axis using the unit measure configured by .xUnits.
    **/
    _chart.xUnitCount = function () {
        if (_unitCount === undefined) {
            var units = _chart.xUnits()(_chart.x().domain()[0], _chart.x().domain()[1], _chart.x().domain());

            if (units instanceof Array)
                _unitCount = units.length;
            else
                _unitCount = units;
        }

        return _unitCount;
    };

    _chart.useRightYAxis = function (_) {
        if (!arguments.length) return _useRightYAxis;
        _useRightYAxis = _;
        return _chart;
    };

    /**
    #### isOrdinal()
    Returns true if the chart is using ordinal xUnits, false otherwise. Most charts must behave somewhat
    differently when with ordinal data and use the result of this method to trigger those special case.
    **/
    _chart.isOrdinal = function () {
        return _chart.xUnits() === dc.units.ordinal;
    };

    _chart._ordinalXDomain = function() {
        var groups = _chart._computeOrderedGroups(_chart.data());
        return groups.map(_chart.keyAccessor());
    };

    function prepareXAxis(g) {
        if (_chart.elasticX() && !_chart.isOrdinal()) {
            _x.domain([_chart.xAxisMin(), _chart.xAxisMax()]);
        }
        else if (_chart.isOrdinal() && _x.domain().length===0) {
            _x.domain(_chart._ordinalXDomain());
        }

        if (_chart.isOrdinal()) {
            _x.rangeBands([0,_chart.xAxisLength()],_rangeBandPadding,_outerRangeBandPadding);
        } else {
            _x.range([0, _chart.xAxisLength()]);
        }

        _xAxis = _xAxis.scale(_chart.x());

        renderVerticalGridLines(g);
    }

    _chart.renderXAxis = function (g) {
        var axisXG = g.selectAll("g.x");

        if (axisXG.empty())
            axisXG = g.append("g")
                .attr("class", "axis x")
                .attr("transform", "translate(" + _chart.margins().left + "," + _chart._xAxisY() + ")");

        var axisXLab = g.selectAll("text."+X_AXIS_LABEL_CLASS);
        if (axisXLab.empty() && _chart.xAxisLabel())
            axisXLab = g.append('text')
                .attr("transform", "translate(" + (_chart.margins().left + _chart.xAxisLength() / 2) + "," + (_chart.height() - _xAxisLabelPadding) + ")")
                .attr('class', X_AXIS_LABEL_CLASS)
                .attr('text-anchor', 'middle')
                .text(_chart.xAxisLabel());
        if (_chart.xAxisLabel() && axisXLab.text() != _chart.xAxisLabel())
            axisYLab.text(_chart.xAxisLabel());

        dc.transition(axisXG, _chart.transitionDuration())
            .call(_xAxis);
    };

    function renderVerticalGridLines(g) {
        var gridLineG = g.selectAll("g." + VERTICAL_CLASS);

        if (_renderVerticalGridLine) {
            if (gridLineG.empty())
                gridLineG = g.insert("g", ":first-child")
                    .attr("class", GRID_LINE_CLASS + " " + VERTICAL_CLASS)
                    .attr("transform", "translate(" + _chart.margins().left + "," + _chart.margins().top + ")");

            var ticks = _xAxis.tickValues() ? _xAxis.tickValues() : _x.ticks(_xAxis.ticks()[0]);

            var lines = gridLineG.selectAll("line")
                .data(ticks);

            // enter
            var linesGEnter = lines.enter()
                .append("line")
                .attr("x1", function (d) {
                    return _x(d);
                })
                .attr("y1", _chart._xAxisY() - _chart.margins().top)
                .attr("x2", function (d) {
                    return _x(d);
                })
                .attr("y2", 0)
                .attr("opacity", 0);
            dc.transition(linesGEnter, _chart.transitionDuration())
                .attr("opacity", 1);

            // update
            dc.transition(lines, _chart.transitionDuration())
                .attr("x1", function (d) {
                    return _x(d);
                })
                .attr("y1", _chart._xAxisY() - _chart.margins().top)
                .attr("x2", function (d) {
                    return _x(d);
                })
                .attr("y2", 0);

            // exit
            lines.exit().remove();
        }
        else {
            gridLineG.selectAll("line").remove();
        }
    }

    _chart._xAxisY = function () {
        return (_chart.height() - _chart.margins().bottom);
    };

    _chart.xAxisLength = function () {
        return _chart.effectiveWidth();
    };

    /**
    #### .xAxisLabel([labelText, [, padding]])
    Set or get the x axis label. If setting the label, you may optionally include additional padding to
    the margin to make room for the label. By default the padded is set to 12 to accomodate the text height.
    **/
    _chart.xAxisLabel = function (_, padding) {
        if (!arguments.length) return _xAxisLabel;
        _xAxisLabel = _;
        _chart.margins().bottom -= _xAxisLabelPadding;
        _xAxisLabelPadding = (padding === undefined) ? DEFAULT_AXIS_LABEL_PADDING : padding;
        _chart.margins().bottom += _xAxisLabelPadding;
        return _chart;
    };

    _chart._prepareYAxis = function(g) {
        if (_y === undefined || _chart.elasticY()) {
            _y = d3.scale.linear();
            _y.domain([_chart.yAxisMin(), _chart.yAxisMax()]).rangeRound([_chart.yAxisHeight(), 0]);
        }

        _y.range([_chart.yAxisHeight(), 0]);
        _yAxis = _yAxis.scale(_y);

        if (_useRightYAxis)
            _yAxis.orient("right");

        renderHorizontalGridLines(g);
    };

    _chart.renderYAxisLabel = function(axisClass, text, rotation, labelXPosition) {
        labelXPosition = labelXPosition || _yAxisLabelPadding;

        var axisYLab = _chart.g().selectAll("text." + Y_AXIS_LABEL_CLASS + "." + axisClass + "-label");
        if (axisYLab.empty() && text) {

            var labelYPosition = (_chart.margins().top + _chart.yAxisHeight() / 2);
            axisYLab = _chart.g().append('text')
                .attr("transform", "translate(" + labelXPosition + "," + labelYPosition + "),rotate(" + rotation + ")")
                .attr('class', Y_AXIS_LABEL_CLASS + " " + axisClass + "-label")
                .attr('text-anchor', 'middle')
                .text(text);
        }
        if (text && axisYLab.text() != text) {
            axisYLab.text(text);
        }
    };

    _chart.renderYAxisAt = function (axisClass, axis, position){
        var axisYG = _chart.g().selectAll("g." + axisClass);
        if (axisYG.empty()) {
            axisYG = _chart.g().append("g")
                .attr("class", "axis " + axisClass)
                .attr("transform", "translate(" + position + "," + _chart.margins().top + ")");
        }

        dc.transition(axisYG, _chart.transitionDuration()).call(axis);
    };

    _chart.renderYAxis = function () {
        var axisPosition = _useRightYAxis ? (_chart.width() - _chart.margins().right) : _chart._yAxisX();
        _chart.renderYAxisAt("y", _yAxis, axisPosition);
        var labelPosition = _useRightYAxis ? (_chart.width() - _yAxisLabelPadding) : _yAxisLabelPadding;
        var rotation = _useRightYAxis ? 90 : -90;
        _chart.renderYAxisLabel("y", _chart.yAxisLabel(), rotation, labelPosition);
    };

    function renderHorizontalGridLines(g) {
        var gridLineG = g.selectAll("g." + HORIZONTAL_CLASS);

        if (_renderHorizontalGridLine) {
            var ticks = _yAxis.tickValues() ? _yAxis.tickValues() : _y.ticks(_yAxis.ticks()[0]);

            if (gridLineG.empty()) {
                gridLineG = g.insert("g", ":first-child")
                    .attr("class", GRID_LINE_CLASS + " " + HORIZONTAL_CLASS)
                    .attr("transform", "translate(" + _chart.margins().left + "," + _chart.margins().top + ")");
            }

            var lines = gridLineG.selectAll("line")
                .data(ticks);

            // enter
            var linesGEnter = lines.enter()
                .append("line")
                .attr("x1", 1)
                .attr("y1", function (d) {
                    return _y(d);
                })
                .attr("x2", _chart.xAxisLength())
                .attr("y2", function (d) {
                    return _y(d);
                })
                .attr("opacity", 0);
            dc.transition(linesGEnter, _chart.transitionDuration())
                .attr("opacity", 1);

            // update
            dc.transition(lines, _chart.transitionDuration())
                .attr("x1", 1)
                .attr("y1", function (d) {
                    return _y(d);
                })
                .attr("x2", _chart.xAxisLength())
                .attr("y2", function (d) {
                    return _y(d);
                });

            // exit
            lines.exit().remove();
        }
        else {
            gridLineG.selectAll("line").remove();
        }
    }

    _chart._yAxisX = function () {
        return _chart.useRightYAxis() ? _chart.width() - _chart.margins().right : _chart.margins().left;
    };


    /**
    #### .yAxisLabel([labelText, [, padding]])
    Set or get the y axis label. If setting the label, you may optionally include additional padding to
    the margin to make room for the label. By default the padded is set to 12 to accomodate the text height.
    **/
    _chart.yAxisLabel = function (_, padding) {
        if (!arguments.length) return _yAxisLabel;
        _yAxisLabel = _;
        _chart.margins().left -= _yAxisLabelPadding;
        _yAxisLabelPadding = (padding === undefined) ? DEFAULT_AXIS_LABEL_PADDING : padding;
        _chart.margins().left += _yAxisLabelPadding;
        return _chart;
    };

    /**
    #### .y([yScale])
    Get or set the y scale. y scale is typically automatically generated by the chart implementation.

    **/
    _chart.y = function (_) {
        if (!arguments.length) return _y;
        _y = _;
        return _chart;
    };

    /**
    #### .yAxis([yAxis])
    Set or get the y axis used by a particular coordinate grid chart instance. This function is most useful when certain y
    axis customization is required. y axis in dc.js is simply an instance
    of [d3 axis object](https://github.com/mbostock/d3/wiki/SVG-Axes#wiki-_axis) therefore it supports any valid d3 axis
    manipulation. **Caution**: The y axis is typically generated by dc chart internal, resetting it might cause unexpected
    outcome.
    ```js
    // customize y axis tick format
    chart.yAxis().tickFormat(function(v) {return v + "%";});
    // customize y axis tick values
    chart.yAxis().tickValues([0, 100, 200, 300]);
    ```

    **/
    _chart.yAxis = function (y) {
        if (!arguments.length) return _yAxis;
        _yAxis = y;
        return _chart;
    };

    /**
    #### .elasticY([boolean])
    Turn on/off elastic y axis. If y axis elasticity is turned on, then the grid chart will attempt to generate and recalculate
    y axis range whenever redraw event is triggered.

    **/
    _chart.elasticY = function (_) {
        if (!arguments.length) return _yElasticity;
        _yElasticity = _;
        return _chart;
    };

    /**
    #### .renderHorizontalGridLines([boolean])
    Turn on/off horizontal grid lines.

    **/
    _chart.renderHorizontalGridLines = function (_) {
        if (!arguments.length) return _renderHorizontalGridLine;
        _renderHorizontalGridLine = _;
        return _chart;
    };

    /**
    #### .renderVerticalGridLines([boolean])
    Turn on/off vertical grid lines.

    **/
    _chart.renderVerticalGridLines = function (_) {
        if (!arguments.length) return _renderVerticalGridLine;
        _renderVerticalGridLine = _;
        return _chart;
    };

    /**
    #### .xAxisMin()
    Return the minimum x value to diplay in the chart. Includes xAxisPadding if set.
    **/
    _chart.xAxisMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return _chart.keyAccessor()(e);
        });
        return dc.utils.subtract(min, _xAxisPadding);
    };

    /**
    #### .xAxisMin()
    Return the maximum x value to diplay in the chart. Includes xAxisPadding if set.
    **/
    _chart.xAxisMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return _chart.keyAccessor()(e);
        });
        return dc.utils.add(max, _xAxisPadding);
    };

    /**
    #### .xAxisMin()
    Return the minimum y value to diplay in the chart. Includes yAxisPadding if set.
    **/
    _chart.yAxisMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return _chart.valueAccessor()(e);
        });
        return dc.utils.subtract(min, _yAxisPadding);
    };

    /**
    #### .yAxisMax()
    Return the maximum y value to diplay in the chart. Includes yAxisPadding if set.
    **/
    _chart.yAxisMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return _chart.valueAccessor()(e);
        });
        return dc.utils.add(max, _yAxisPadding);
    };

    /**
    #### .yAxisPadding([padding])
    if elasticY is turned on otherwise it will be simply ignored.
    Set or get y axis padding when elastic y axis is turned on. The padding will be added to the top of the y axis if and only

    * padding - could be integer or percentage in string (e.g. "10%"). Padding can be applied to number or date.
    When padding with date, integer represents number of days being padded while percentage string will be treated
    as number.

    **/
    _chart.yAxisPadding = function (_) {
        if (!arguments.length) return _yAxisPadding;
        _yAxisPadding = _;
        return _chart;
    };

    _chart.yAxisHeight = function () {
        return _chart.effectiveHeight();
    };

    /**
    #### .round([rounding function])
    Set or get the rounding function for x axis. Rounding is mainly used to provide stepping capability when in place
    selection based filter is enable.
    ```js
    // set x unit round to by month, this will make sure range selection brash will
    // extend on a month-by-month basis
    chart.round(d3.time.month.round);
    ```

    **/
    _chart.round = function (_) {
        if (!arguments.length) return _round;
        _round = _;
        return _chart;
    };

    _chart._rangeBandPadding = function (_) {
        if (!arguments.length) return _rangeBandPadding;
        _rangeBandPadding = _;
        return _chart;
    };

    _chart._outerRangeBandPadding = function (_) {
        if (!arguments.length) return _outerRangeBandPadding;
        _outerRangeBandPadding = _;
        return _chart;
    };

    dc.override(_chart, "filter", function (_) {
        if (!arguments.length) return _chart._filter();

        _chart._filter(_);

        if (_) {
            _chart.brush().extent(_);
        } else {
            _chart.brush().clear();
        }

        return _chart;
    });

    _chart.brush = function (_) {
        if (!arguments.length) return _brush;
        _brush = _;
        return _chart;
    };

    function brushHeight() {
        return _chart._xAxisY() - _chart.margins().top;
    }

    _chart.renderBrush = function (g) {
        if (_brushOn) {
            _brush.on("brush", _chart._brushing);
            _brush.on("brushstart", _chart._disableMouseZoom);
            _brush.on("brushend", configureMouseZoom);

            var gBrush = g.append("g")
                .attr("class", "brush")
                .attr("transform", "translate(" + _chart.margins().left + "," + _chart.margins().top + ")")
                .call(_brush.x(_chart.x()));
            _chart.setBrushY(gBrush);
            _chart.setHandlePaths(gBrush);

            if (_chart.hasFilter()) {
                _chart.redrawBrush(g);
            }
        }
    };

    _chart.setHandlePaths = function (gBrush) {
        gBrush.selectAll(".resize").append("path").attr("d", _chart.resizeHandlePath);
    };

    _chart.setBrushY = function(gBrush){
        gBrush.selectAll("rect").attr("height", brushHeight());
    };

    _chart.extendBrush = function () {
        var extent = _brush.extent();
        if (_chart.round()) {
            extent[0] = extent.map(_chart.round())[0];
            extent[1] = extent.map(_chart.round())[1];

            _g.select(".brush")
                .call(_brush.extent(extent));
        }
        return extent;
    };

    _chart.brushIsEmpty = function (extent) {
        return _brush.empty() || !extent || extent[1] <= extent[0];
    };

    _chart._brushing = function() {
        var extent = _chart.extendBrush();

        _chart.redrawBrush(_g);

        if (_chart.brushIsEmpty(extent)) {
            dc.events.trigger(function () {
                _chart.filter(null);
                _chart.redrawGroup();
            }, dc.constants.EVENT_DELAY);
        } else {
            var rangedFilter = dc.filters.RangedFilter(extent[0], extent[1]);

            dc.events.trigger(function () {
                _chart.replaceFilter(rangedFilter);
                _chart.redrawGroup();
            }, dc.constants.EVENT_DELAY);
        }
    };

    _chart.redrawBrush = function (g) {
        if (_brushOn) {
            if (_chart.filter() && _chart.brush().empty())
                _chart.brush().extent(_chart.filter());

            var gBrush = g.select("g.brush");
            gBrush.call(_chart.brush().x(_chart.x()));
            _chart.setBrushY(gBrush);
        }

        _chart.fadeDeselectedArea();
    };

    _chart.fadeDeselectedArea = function () {
        // do nothing, sub-chart should override this function
    };

    // borrowed from Crossfilter example
    _chart.resizeHandlePath = function (d) {
        var e = +(d == "e"), x = e ? 1 : -1, y = brushHeight() / 3;
        /*jshint -W014 */
        return "M" + (0.5 * x) + "," + y
            + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
            + "V" + (2 * y - 6)
            + "A6,6 0 0 " + e + " " + (0.5 * x) + "," + (2 * y)
            + "Z"
            + "M" + (2.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8)
            + "M" + (4.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8);
        /*jshint +W014 */
    };

    function getClipPathId() {
        return _chart.anchorName() + "-clip";
    }

    /**
    #### .clipPadding([padding])
    Get or set padding in pixel for clip path. Once set padding will be applied evenly to top, left, right, and bottom padding
     when clip path is generated. If set to zero, then the clip area will be exactly the chart body area minus the margins.
     Default: 5

    **/
    _chart.clipPadding = function (p) {
        if (!arguments.length) return _clipPadding;
        _clipPadding = p;
        return _chart;
    };

    function generateClipPath() {
        var defs = dc.utils.appendOrSelect(_parent, "defs");

        var chartBodyClip = dc.utils.appendOrSelect(defs, "clipPath").attr("id", getClipPathId());

        var padding = _clipPadding * 2;

        dc.utils.appendOrSelect(chartBodyClip, "rect")
            .attr("width", _chart.xAxisLength() + padding)
            .attr("height", _chart.yAxisHeight() + padding);
    }

    _chart._preprocessData = function() {};

    _chart._doRender = function () {
        _chart.resetSvg();

        _chart._preprocessData();

        _chart._generateG();
        generateClipPath();

        drawChart(true);

        configureMouseZoom();

        return _chart;
    };

    _chart._doRedraw = function () {
        _chart._preprocessData();

        drawChart(false);

        return _chart;
    };

    function drawChart (render) {
        if (_chart.isOrdinal())
            _brushOn = false;

        prepareXAxis(_chart.g());
        _chart._prepareYAxis(_chart.g());

        _chart.plotData();

        if (_chart.elasticX() || _refocused || render)
            _chart.renderXAxis(_chart.g());

        if (_chart.elasticY() || render)
            _chart.renderYAxis(_chart.g());

        if (render)
            _chart.renderBrush(_chart.g());
        else
            _chart.redrawBrush(_chart.g());
    }

    function configureMouseZoom () {
        if (_mouseZoomable) {
            _chart._enableMouseZoom();
        }
        else if (_hasBeenMouseZoomable) {
            _chart._disableMouseZoom();
        }
    }

    _chart._enableMouseZoom = function () {
        _hasBeenMouseZoomable = true;
        _zoom.x(_chart.x())
            .scaleExtent(_zoomScale)
            .size([_chart.width(),_chart.height()]);
        _chart.root().call(_zoom);
    };

    _chart._disableMouseZoom = function () {
        _chart.root().call(_nullZoom);
    };

    function zoomHandler() {
        _refocused = true;
        if (_zoomOutRestrict) {
            _chart.x().domain(constrainRange(_chart.x().domain(), _xOriginalDomain));
            if (_rangeChart) {
                _chart.x().domain(constrainRange(_chart.x().domain(), _rangeChart.x().domain()));
            }
        }

        var domain = _chart.x().domain();
        var domFilter = dc.filters.RangedFilter(domain[0], domain[1]);

        _chart.replaceFilter(domFilter);
        _chart.rescale();
        _chart.redraw();

        if (_rangeChart && !rangesEqual(_chart.filter(), _rangeChart.filter())) {
            dc.events.trigger( function () {
                _rangeChart.replaceFilter(domFilter);
                _rangeChart.redraw();
            });
        }

        _chart._invokeZoomedListener();

        dc.events.trigger(function () {
            _chart.redrawGroup();
        }, dc.constants.EVENT_DELAY);

        _refocused = !rangesEqual(domain, _xOriginalDomain);
    }

    function constrainRange(range, constraint) {
        var constrainedRange = [];
        constrainedRange[0] = d3.max([range[0], constraint[0]]);
        constrainedRange[1] = d3.min([range[1], constraint[1]]);
        return constrainedRange;
    }

    /**
    #### .focus([range])
    Zoom this chart to focus on the given range. The given range should be an array containing only 2 element([start, end]) defining an range in x domain. If the range is not given or set to null, then the zoom will be reset. _For focus to work elasticX has to be turned off otherwise focus will be ignored._
    ```js
    chart.renderlet(function(chart){
        // smooth the rendering through event throttling
        dc.events.trigger(function(){
            // focus some other chart to the range selected by user on this chart
            someOtherChart.focus(chart.filter());
        });
    })
    ```

    **/
    _chart.focus = function (range) {
        if (hasRangeSelected(range))
            _chart.x().domain(range);
        else
            _chart.x().domain(_xOriginalDomain);

        _zoom.x(_chart.x());
        zoomHandler();
    };

    _chart.refocused = function () {
        return _refocused;
    };

    _chart.focusChart = function (c) {
        if (!arguments.length) return _focusChart;
        _focusChart = c;
        _chart.on("filtered", function (chart) {
            if (!rangesEqual(chart.filter(), _focusChart.filter())) {
                dc.events.trigger(function () {
                    _focusChart.focus(chart.filter());
                });
            }
        });
        return _chart;
    };

    function rangesEqual(range1, range2) {
        if (!range1 && !range2) {
            return true;
        }

        if (range1.length === 0 && range2.length === 0) {
            return true;
        }

        if (range1 && range2 &&
            range1[0].valueOf() === range2[0].valueOf() &&
            range1[1].valueOf() === range2[1].valueOf()) {
            return true;
        }

        return false;
    }

    /**
    #### .brushOn([boolean])
    Turn on/off the brush based in-place range filter. When the brush is on then user will be able to simply drag the mouse
    across the chart to perform range filtering based on the extend of the brush. However turning on brush filter will essentially
    disable other interactive elements on the chart such as the highlighting, tool-tip, and reference lines on a chart. Zooming will still
    be possible if enabled, but only via scrolling (panning will be disabled.) Default value is "true".

    **/
    _chart.brushOn = function (_) {
        if (!arguments.length) return _brushOn;
        _brushOn = _;
        return _chart;
    };

    function hasRangeSelected(range) {
        return range instanceof Array && range.length > 1;
    }

    return _chart;
};