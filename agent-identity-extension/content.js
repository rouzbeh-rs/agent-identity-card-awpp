/**
 * Agent White Paper Protocol - Proof-of-Concept Content Script
 * 
 * This script implements a client-side verifier and renderer for the AWPP.
 * It detects known AI agent URLs, loads the corresponding pre-authored JSON
 * data model from the local mock registry, and renders an Agent Identity Card
 * overlay in the browser DOM.
 * 
 * IMPORTANT: This extension does NOT scrape, infer, or guess agent capabilities.
 * All data comes from pre-authored JSON files created through manual auditing
 * of publicly available documentation. This is consistent with the AWPP's 
 * philosophy: accountability comes from verified claims, not automated inference.
 */

// ============================================================
// Mock Registry: Maps hostnames to their JSON data model files
// In a fully deployed ecosystem, platforms would host these files.
// For this PoC, we bundle them with the extension.
// ============================================================
const AGENT_REGISTRY = {
  'perplexity.ai': 'perplexity',
  'www.perplexity.ai': 'perplexity',
  'claude.ai': 'claude',
  'chat.openai.com': 'chatgpt',
  'chatgpt.com': 'chatgpt'
};

// Embedded JSON data models (bundled mock registry)
const AGENT_DATA = {};

// ============================================================
// Initialization
// ============================================================
(async function init() {
  const hostname = window.location.hostname;
  const agentKey = AGENT_REGISTRY[hostname];
  
  if (!agentKey) return; // Not a known agent site
  
  try {
    // Load the JSON data model from the extension's bundled files
    const url = chrome.runtime.getURL(`data/${agentKey}.json`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load data for ${agentKey}`);
    const agentData = await response.json();
    
    // Render the Identity Card
    renderCard(agentData);
  } catch (error) {
    console.error('[AWPP] Error loading agent data:', error);
  }
})();

// ============================================================
// Card Renderer
// ============================================================
function renderCard(data) {
  // Don't inject twice
  if (document.getElementById('awpp-card-container')) return;
  
  const container = document.createElement('div');
  container.id = 'awpp-card-container';
  
  // Toggle button (floating)
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'awpp-toggle-btn';
  toggleBtn.title = 'View Agent Identity Card';
  toggleBtn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
  `;
  
  // Card panel
  const panel = document.createElement('div');
  panel.id = 'awpp-card-panel';
  
  panel.innerHTML = buildCardHTML(data);
  
  // Toggle behavior
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('awpp-visible');
  });
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      panel.classList.remove('awpp-visible');
    }
  });
  
  container.appendChild(panel);
  container.appendChild(toggleBtn);
  document.body.appendChild(container);
  
  // Wire up export buttons after DOM insertion
  setTimeout(() => {
    const pngBtn = document.getElementById('awpp-export-png');
    const jsonBtn = document.getElementById('awpp-export-json');
    
    if (pngBtn) {
      pngBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportCardAsPNG(data);
      });
    }
    
    if (jsonBtn) {
      jsonBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportCardAsJSON(data);
      });
    }
  }, 100);
}

// ============================================================
// Export Functions
// ============================================================

/**
 * Exports the Identity Card as a PNG image using manual Canvas rendering.
 * This approach avoids SVG foreignObject security restrictions in Edge/Chrome
 * by directly drawing the card content onto a canvas element.
 */
async function exportCardAsPNG(data) {
  const { identity, purpose, architecture, capabilities, communication, evaluation } = data;
  const auditMeta = data._auditMetadata;
  const undisclosedCount = auditMeta?.fieldsNotDisclosed?.length || 0;
  
  const btn = document.getElementById('awpp-export-png');
  const originalText = btn.textContent;
  btn.textContent = 'Exporting...';
  btn.disabled = true;
  
  try {
    const scale = 2; // 2x for high-DPI
    const W = 400;
    
    // Pre-calculate content to determine canvas height
    const sections = [];
    
    // Header
    sections.push({ type: 'header', name: identity.name, version: identity.version, operator: identity.legalOperator });
    
    // Transparency
    let tLabel, tColor, tBg;
    if (undisclosedCount <= 1) { tLabel = 'HIGH TRANSPARENCY'; tColor = '#166534'; tBg = '#dcfce7'; }
    else if (undisclosedCount <= 3) { tLabel = 'MODERATE TRANSPARENCY'; tColor = '#854d0e'; tBg = '#fef9c3'; }
    else { tLabel = 'LOW TRANSPARENCY'; tColor = '#991b1b'; tBg = '#fee2e2'; }
    sections.push({ type: 'transparency', label: tLabel, color: tColor, bg: tBg, count: undisclosedCount });
    
    // Text sections
    sections.push({ type: 'text', title: 'ROLE & RESPONSIBILITIES', body: purpose.task });
    sections.push({ type: 'text', title: 'OUT-OF-SCOPE USE', body: purpose.outOfScopeUse });
    sections.push({ type: 'text', title: 'ARCHITECTURE', body: `Base Model: ${truncate(architecture.baseModel, 150)}\nKnowledge: ${truncate(architecture.knowledgeSystem.type, 120)}` });
    
    // Tools
    sections.push({ type: 'tools', title: 'AUTHORIZED ACTIONS', tools: capabilities.tools.map(t => t.id) });
    
    // Benchmarks
    sections.push({ type: 'benchmarks', title: 'PERFORMANCE RECORD', benchmarks: evaluation.benchmarks });
    
    // Limitations
    sections.push({ type: 'limitations', title: 'KNOWN LIMITATIONS', items: evaluation.limitations });
    
    // I/O
    sections.push({ type: 'text', title: 'I/O MODALITIES', body: `Input: ${communication.inputModalities.join(', ')}\nOutput: ${communication.outputModalities.join(', ')}` });
    
    // Footer
    sections.push({ type: 'footer', license: identity.license });
    
    // Now render to canvas
    // First pass: calculate height
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = W * scale;
    tempCanvas.height = 3000 * scale;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.scale(scale, scale);
    const totalHeight = drawCard(tempCtx, W, sections, true);
    
    // Second pass: render at correct height
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = totalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    // Paint white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, totalHeight);
    drawCard(ctx, W, sections, false);
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = identity.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      a.href = url;
      a.download = `agent_identity_card_${safeName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      btn.textContent = 'Exported!';
      setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1500);
    }, 'image/png');
    
  } catch (error) {
    console.error('[AWPP] Export error:', error);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

/**
 * Draws the Identity Card onto a canvas context.
 * Returns the total height used.
 */
function drawCard(ctx, W, sections, measureOnly) {
  const PAD = 18;
  const CONTENT_W = W - PAD * 2;
  let y = 0;
  
  for (const section of sections) {
    switch (section.type) {
      case 'header': {
        const headerH = 90;
        if (!measureOnly) {
          // Gradient background
          const grad = ctx.createLinearGradient(0, y, W, y + headerH);
          grad.addColorStop(0, '#1e3a5f');
          grad.addColorStop(1, '#2563eb');
          ctx.fillStyle = grad;
          ctx.fillRect(0, y, W, headerH);
          
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = '600 9px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.letterSpacing = '1px';
          ctx.fillText('AGENT IDENTITY CARD', PAD, y + 24);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 18px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(section.name, PAD, y + 48);
          
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.font = '400 11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(section.version, PAD, y + 64);
          ctx.fillText('Operated by: ' + section.operator, PAD, y + 80);
        }
        y += headerH;
        break;
      }
      
      case 'transparency': {
        if (!measureOnly) {
          y += 14;
          ctx.fillStyle = '#64748b';
          ctx.font = '700 9px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText('TRANSPARENCY LEVEL', PAD, y + 10);
          
          // Badge
          const badgeW = ctx.measureText(section.label).width + 16;
          ctx.fillStyle = section.bg;
          roundRect(ctx, PAD, y + 16, badgeW, 22, 4);
          ctx.fill();
          ctx.fillStyle = section.color;
          ctx.font = '600 9px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(section.label, PAD + 8, y + 31);
          
          ctx.fillStyle = '#94a3b8';
          ctx.font = '400 10px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(`(${section.count} undisclosed field${section.count !== 1 ? 's' : ''})`, PAD + badgeW + 8, y + 31);
        }
        y += 52;
        break;
      }
      
      case 'text': {
        if (!measureOnly) {
          drawSeparator(ctx, W, y);
        }
        y += 14;
        if (!measureOnly) {
          ctx.fillStyle = '#64748b';
          ctx.font = '700 9px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(section.title, PAD, y + 10);
        }
        y += 18;
        
        ctx.font = '400 11px -apple-system, BlinkMacSystemFont, sans-serif';
        const lines = wrapText(ctx, section.body, CONTENT_W);
        if (!measureOnly) {
          ctx.fillStyle = '#334155';
          lines.forEach((line, i) => {
            ctx.fillText(line, PAD, y + 12 + i * 16);
          });
        }
        y += lines.length * 16 + 14;
        break;
      }
      
      case 'tools': {
        if (!measureOnly) {
          drawSeparator(ctx, W, y);
        }
        y += 14;
        if (!measureOnly) {
          ctx.fillStyle = '#64748b';
          ctx.font = '700 9px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(section.title, PAD, y + 10);
        }
        y += 20;
        
        ctx.font = '500 10px -apple-system, BlinkMacSystemFont, sans-serif';
        let tx = PAD;
        let ty = y;
        section.tools.forEach(tool => {
          const tw = ctx.measureText('✓ ' + tool).width + 16;
          if (tx + tw > W - PAD) { tx = PAD; ty += 26; }
          if (!measureOnly) {
            ctx.fillStyle = '#dcfce7';
            roundRect(ctx, tx, ty, tw, 20, 10);
            ctx.fill();
            ctx.fillStyle = '#166534';
            ctx.fillText('✓ ' + tool, tx + 8, ty + 14);
          }
          tx += tw + 6;
        });
        y = ty + 32;
        break;
      }
      
      case 'benchmarks': {
        if (!measureOnly) {
          drawSeparator(ctx, W, y);
        }
        y += 14;
        if (!measureOnly) {
          ctx.fillStyle = '#64748b';
          ctx.font = '700 9px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(section.title, PAD, y + 10);
        }
        y += 18;
        
        section.benchmarks.forEach(b => {
          if (!measureOnly) {
            ctx.font = '400 10px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#475569';
            ctx.fillText(truncate(b.name, 40), PAD, y + 12);
            
            const isND = b.score === 'Not disclosed';
            ctx.fillStyle = isND ? '#dc2626' : '#1e3a5f';
            ctx.font = (isND ? '600 italic' : '700') + ' 10px -apple-system, BlinkMacSystemFont, sans-serif';
            const scoreW = ctx.measureText(b.score).width;
            ctx.fillText(b.score, W - PAD - scoreW, y + 12);
          }
          y += 20;
        });
        y += 6;
        break;
      }
      
      case 'limitations': {
        if (!measureOnly) {
          drawSeparator(ctx, W, y);
        }
        y += 14;
        if (!measureOnly) {
          ctx.fillStyle = '#64748b';
          ctx.font = '700 9px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(section.title, PAD, y + 10);
        }
        y += 18;
        
        ctx.font = '400 10px -apple-system, BlinkMacSystemFont, sans-serif';
        section.items.forEach(item => {
          const lines = wrapText(ctx, item, CONTENT_W - 16);
          if (!measureOnly) {
            ctx.fillStyle = '#475569';
            ctx.fillText('⚠', PAD, y + 12);
            lines.forEach((line, i) => {
              ctx.fillText(line, PAD + 16, y + 12 + i * 14);
            });
          }
          y += lines.length * 14 + 6;
        });
        y += 6;
        break;
      }
      
      case 'footer': {
        if (!measureOnly) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, y, W, 50);
          
          ctx.fillStyle = '#94a3b8';
          ctx.font = '400 8px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Agent White Paper Protocol v1.0 — Proof of Concept', W / 2, y + 14);
          ctx.fillText('Data sourced from public documentation. Not developer-verified.', W / 2, y + 26);
          ctx.fillText('License: ' + section.license, W / 2, y + 38);
          ctx.textAlign = 'left';
        }
        y += 50;
        break;
      }
    }
  }
  
  // Draw white background behind everything (first pass only gives us height)
  if (!measureOnly) {
    // Background is drawn in each section, but we need to ensure the card looks right
  }
  
  return y;
}

/**
 * Draw a horizontal separator line.
 */
function drawSeparator(ctx, W, y) {
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

/**
 * Draw a rounded rectangle path.
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Word-wrap text to fit within maxWidth. Returns array of lines.
 */
function wrapText(ctx, text, maxWidth) {
  const allLines = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        allLines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) allLines.push(line);
  }
  return allLines;
}

/**
 * Exports the raw JSON data model as a downloadable .json file.
 * Includes all schema fields except internal audit metadata.
 */
function exportCardAsJSON(data) {
  // Deep clone to avoid mutating the original
  const exportData = JSON.parse(JSON.stringify(data));
  // Remove internal audit metadata (researcher's data, not public schema)
  delete exportData._auditMetadata;
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = data.identity.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  a.href = url;
  a.download = `agent_white_paper_${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// HTML Builder
// ============================================================
function buildCardHTML(data) {
  const { identity, purpose, architecture, capabilities, communication, evaluation } = data;
  
  // Determine overall transparency level based on audit metadata
  const auditMeta = data._auditMetadata;
  const undisclosedCount = auditMeta?.fieldsNotDisclosed?.length || 0;
  let transparencyLevel, transparencyClass;
  if (undisclosedCount <= 1) {
    transparencyLevel = 'High Transparency';
    transparencyClass = 'awpp-risk-green';
  } else if (undisclosedCount <= 3) {
    transparencyLevel = 'Moderate Transparency';
    transparencyClass = 'awpp-risk-yellow';
  } else {
    transparencyLevel = 'Low Transparency';
    transparencyClass = 'awpp-risk-red';
  }
  
  return `
    <!-- Header: Identity & Accountability -->
    <div class="awpp-header">
      <div class="awpp-header-title">Agent Identity Card</div>
      <div class="awpp-agent-name">${escapeHTML(identity.name)}</div>
      <div class="awpp-agent-version">${escapeHTML(identity.version)}</div>
      <div class="awpp-operator">Operated by: ${escapeHTML(identity.legalOperator)}</div>
    </div>
    
    <!-- Transparency Level -->
    <div class="awpp-section">
      <div class="awpp-section-title">Transparency Level</div>
      <span class="awpp-risk-indicator ${transparencyClass}">
        ${transparencyLevel}
      </span>
      <span style="font-size:11px; color:#94a3b8; margin-left:8px;">
        (${undisclosedCount} undisclosed field${undisclosedCount !== 1 ? 's' : ''})
      </span>
    </div>
    
    <!-- Role & Responsibilities -->
    <div class="awpp-section">
      <div class="awpp-section-title">Role &amp; Responsibilities</div>
      <div class="awpp-section-text">${escapeHTML(purpose.task)}</div>
    </div>
    
    <!-- Out of Scope -->
    <div class="awpp-section">
      <div class="awpp-section-title">Out-of-Scope Use</div>
      <div class="awpp-section-text">${escapeHTML(purpose.outOfScopeUse)}</div>
    </div>
    
    <!-- Architecture Summary -->
    <div class="awpp-section">
      <div class="awpp-section-title">Architecture</div>
      <div class="awpp-section-text" style="font-size:12px;">
        <strong>Base Model:</strong> ${escapeHTML(truncate(architecture.baseModel, 150))}<br>
        <strong>Knowledge:</strong> ${escapeHTML(truncate(architecture.knowledgeSystem.type, 120))}
      </div>
    </div>
    
    <!-- Authorized Actions (Tools) -->
    <div class="awpp-section">
      <div class="awpp-section-title">Authorized Actions</div>
      <ul class="awpp-tool-list">
        ${capabilities.tools.map(tool => `
          <li class="awpp-tool-item awpp-enabled" title="${escapeHTML(tool.description)}">
            ${escapeHTML(tool.id)}
          </li>
        `).join('')}
      </ul>
    </div>
    
    <!-- Performance Record -->
    <div class="awpp-section">
      <div class="awpp-section-title">Performance Record</div>
      ${evaluation.benchmarks.map(b => `
        <div class="awpp-benchmark-row">
          <span class="awpp-benchmark-name">${escapeHTML(b.name)}</span>
          <span class="awpp-benchmark-score ${b.score === 'Not disclosed' ? 'awpp-not-disclosed' : ''}">
            ${escapeHTML(b.score)}
          </span>
        </div>
      `).join('')}
    </div>
    
    <!-- Known Limitations -->
    <div class="awpp-section">
      <div class="awpp-section-title">Known Limitations</div>
      <ul class="awpp-limitation-list">
        ${evaluation.limitations.slice(0, 4).map(lim => `
          <li class="awpp-limitation-item">${escapeHTML(lim)}</li>
        `).join('')}
        ${evaluation.limitations.length > 4 ? `
          <li class="awpp-limitation-item" style="color:#2563eb; cursor:pointer; font-style:italic;" 
              onclick="this.parentElement.innerHTML = this.parentElement.dataset.full" 
              data-full='${evaluation.limitations.map(l => `<li class="awpp-limitation-item">${escapeHTML(l)}</li>`).join('')}'>
            + ${evaluation.limitations.length - 4} more...
          </li>
        ` : ''}
      </ul>
    </div>
    
    <!-- I/O Modalities -->
    <div class="awpp-section">
      <div class="awpp-section-title">I/O Modalities</div>
      <div class="awpp-section-text" style="font-size:12px;">
        <strong>Input:</strong> ${communication.inputModalities.join(', ')}<br>
        <strong>Output:</strong> ${communication.outputModalities.join(', ')}
      </div>
    </div>
    
    <!-- Footer -->
    <div class="awpp-footer">
      <div style="display:flex; gap:8px; justify-content:center; margin-bottom:8px;">
        <button id="awpp-export-png" class="awpp-export-btn" title="Export as PNG image">Export PNG</button>
        <button id="awpp-export-json" class="awpp-export-btn" title="Export raw JSON data">Export JSON</button>
      </div>
      <div class="awpp-footer-text">
        Agent White Paper Protocol v1.0 &mdash; Proof of Concept<br>
        Data sourced from public documentation. Not developer-verified.<br>
        License: ${escapeHTML(identity.license)}
      </div>
    </div>
  `;
}

// ============================================================
// Utility Functions
// ============================================================
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}
