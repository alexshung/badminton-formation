const fs = require('fs');
let court = fs.readFileSync('court.js', 'utf8');

// Remove filters from internal lines, use solid bright colors
court = court.replace(/filter="url\(#cyanGlow\)"/g, '');
court = court.replace(/rgba\(0,212,255,.85\)/g, '#00ff00'); // Bright green for visibility
court = court.replace(/rgba\(0,212,255,0.9\)/g, '#00ff00');

fs.writeFileSync('court.js', court);
console.log('Fixed court lines - removed filters, using bright green');
