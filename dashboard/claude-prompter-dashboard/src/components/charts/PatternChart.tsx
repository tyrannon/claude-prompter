import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './PatternChart.css';

interface Pattern {
  pattern: string;
  frequency: number;
  category: string;
}

interface PatternChartProps {
  patterns: Pattern[];
}

const PatternChart: React.FC<PatternChartProps> = ({ patterns }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || patterns.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous content

    const margin = { top: 20, right: 20, bottom: 80, left: 60 };
    const width = 400 - margin.left - margin.right;
    const height = 300 - margin.bottom - margin.top;

    const container = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = container
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleBand()
      .domain(patterns.map(d => d.pattern))
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(patterns, d => d.frequency) || 0])
      .range([height, 0]);

    // Color scale for different categories
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['implementation', 'architecture', 'security', 'testing'])
      .range(['#667eea', '#764ba2', '#f093fb', '#f5576c']);

    // Create gradient definitions
    const defs = container.append('defs');
    
    patterns.forEach((pattern, index) => {
      const gradient = defs.append('linearGradient')
        .attr('id', `gradient-${index}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', height)
        .attr('x2', 0).attr('y2', 0);

      const color = colorScale(pattern.category);
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', color)
        .attr('stop-opacity', 0.8);

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', color)
        .attr('stop-opacity', 1);
    });

    // Create bars with animation
    const bars = g.selectAll('.bar')
      .data(patterns)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.pattern) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', (d, i) => `url(#gradient-${i})`)
      .attr('rx', 4)
      .attr('ry', 4);

    // Animate bars
    bars.transition()
      .duration(1000)
      .delay((d, i) => i * 100)
      .attr('y', d => yScale(d.frequency))
      .attr('height', d => height - yScale(d.frequency));

    // Add frequency labels on bars
    const labels = g.selectAll('.bar-label')
      .data(patterns)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', d => (xScale(d.pattern) || 0) + xScale.bandwidth() / 2)
      .attr('y', height)
      .attr('text-anchor', 'middle')
      .attr('dy', '-5px')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('fill', '#2d3748')
      .text(d => `${d.frequency}x`);

    // Animate labels
    labels.transition()
      .duration(1000)
      .delay((d, i) => i * 100)
      .attr('y', d => yScale(d.frequency));

    // Add x-axis
    const xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`);

    xAxis.selectAll('.tick')
      .data(patterns)
      .enter()
      .append('g')
      .attr('class', 'tick')
      .attr('transform', d => `translate(${(xScale(d.pattern) || 0) + xScale.bandwidth() / 2}, 0)`)
      .append('text')
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#718096')
      .text(d => {
        // Truncate long pattern names
        const words = d.pattern.split('-');
        if (words.length > 2) {
          return words.slice(0, 2).join('-') + '...';
        }
        return d.pattern;
      })
      .each(function(d) {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line: string[] = [];
        let lineNumber = 0;
        const lineHeight = 1.1; // ems
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy") || "0");
        let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        
        while ((word = words.pop())) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node()!.getComputedTextLength() > xScale.bandwidth() - 10) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
          }
        }
      });

    // Add y-axis
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).ticks(5))
      .style('font-size', '10px')
      .style('color', '#718096');

    // Add y-axis label
    g.append('text')
      .attr('class', 'y-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#718096')
      .style('font-weight', '500')
      .text('Usage Frequency');

    // Add hover effects
    bars.on('mouseover', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('opacity', 0.8)
        .attr('stroke', '#2d3748')
        .attr('stroke-width', 2);

      // Show tooltip (simplified)
      const tooltip = g.append('g')
        .attr('class', 'tooltip')
        .attr('transform', `translate(${(xScale(d.pattern) || 0) + xScale.bandwidth() / 2}, ${yScale(d.frequency) - 10})`);

      tooltip.append('rect')
        .attr('x', -40)
        .attr('y', -25)
        .attr('width', 80)
        .attr('height', 20)
        .attr('fill', '#2d3748')
        .attr('rx', 4)
        .attr('opacity', 0.9);

      tooltip.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -10)
        .style('font-size', '11px')
        .style('fill', 'white')
        .style('font-weight', '500')
        .text(`${d.category}: ${d.frequency}`);
    })
    .on('mouseout', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('opacity', 1)
        .attr('stroke', 'none');

      g.select('.tooltip').remove();
    });

  }, [patterns]);

  if (patterns.length === 0) {
    return (
      <div className="pattern-chart-empty">
        <p>No patterns data available yet.</p>
        <p>Start using claude-prompter to see your pattern mastery!</p>
      </div>
    );
  }

  return (
    <div className="pattern-chart-container">
      <svg ref={svgRef} className="pattern-chart"></svg>
    </div>
  );
};

export default PatternChart;