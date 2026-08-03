/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Camera, Plus, Trash2, Sliders, Scissors, Archive,
  Upload, Sparkles, RefreshCw, Layers, CheckCircle2, AlertCircle,
  Search, Eye, Tag, Palette, Info, Download, FileText
} from 'lucide-react';

// Fabric material presets for quick tagging
const MATERIAL_PRESETS = [
  'Linen', 'Cotton Lawn', 'Silk Crepe', 'Wool Flannel', 'Denim',
  'Tencel Satin', 'Velvet', 'Rayon Challis', 'Corduroy', 'Gabardine'
];

// Color families for classification and filtering
const COLOR_FAMILIES_PRESETS = [
  { name: 'All', color: 'conic-gradient(from 0deg, #F43F5E, #EA580C, #EAB308, #10B981, #0EA5E9, #8B5CF6, #F43F5E)' },
  { name: 'Red / Pink', color: '#F43F5E' },
  { name: 'Blue / Teal', color: '#0EA5E9' },
  { name: 'Green / Olive', color: '#10B981' },
  { name: 'Yellow / Mustard', color: '#F59E0B' },
  { name: 'Orange / Rust', color: '#F97316' },
  { name: 'Purple / Berry', color: '#8B5CF6' },
  { name: 'Beige / Brown', color: '#B45309' },
  { name: 'Black / White / Gray', color: '#6B7280' }
];

// Predefined colors for card tagging
const PREDEFINED_COLORS = [
  { name: 'Sage Green', hex: '#8A9A86' },
  { name: 'Goldenrod Yellow', hex: '#E3A857' },
  { name: 'Indigo Blue', hex: '#1E293B' },
  { name: 'Blush Pink', hex: '#E8C3C9' },
  { name: 'Crimson Red', hex: '#991B1B' },
  { name: 'Forest Green', hex: '#064E3B' },
  { name: 'Oatmeal Natural', hex: '#eae1d4' },
  { name: 'Ivory Pearl', hex: '#FDFBF7' },
  { name: 'Midnight Black', hex: '#111827' },
  { name: 'Slate Gray', hex: '#4B5563' },
  { name: 'Warm Brown', hex: '#78350F' },
  { name: 'Plum Purple', hex: '#581C87' }
];

// Helper to convert hex to RGB
function hexToRgb(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Helper to categorize hex colors into family groups
function getClosestColorFamily(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'Black / White / Gray';

  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Neutral grayscale check
  if (delta < 20) {
    return 'Black / White / Gray';
  }

  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  // Saturation / brightness checks for beige / brown
  const brightness = max / 255;
  const saturation = max === 0 ? 0 : delta / max;

  if (hue >= 15 && hue < 50 && brightness < 0.75 && saturation < 0.7) {
    return 'Beige / Brown';
  }
  if (brightness > 0.6 && saturation < 0.25) {
    return 'Beige / Brown';
  }

  if (hue >= 340 || hue < 15) {
    return 'Red / Pink';
  } else if (hue >= 15 && hue < 45) {
    return 'Orange / Rust';
  } else if (hue >= 45 && hue < 75) {
    return 'Yellow / Mustard';
  } else if (hue >= 75 && hue < 165) {
    return 'Green / Olive';
  } else if (hue >= 165 && hue < 255) {
    return 'Blue / Teal';
  } else {
    return 'Purple / Berry';
  }
}

// Sample initial fabric items to pre-populate the stash so the dashboard looks great immediately
const INITIAL_STASH = [
  {
    id: 'stash-1',
    name: 'Sage Green Washed Linen',
    material: 'Linen',
    quantity: '3.5',
    unit: 'yards',
    width: '58"',
    color: '#8A9A86',
    colorFamily: 'Green / Olive',
    weight: 'Medium Weight',
    notes: 'Medium weight, perfectly soft drape. Plan to use for Aurelia Wrap Dress.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80',
    dateAdded: '2026-07-10'
  },
  {
    id: 'stash-2',
    name: 'Goldenrod Silk Habotai',
    material: 'Silk Crepe',
    quantity: '2.0',
    unit: 'yards',
    width: '45"',
    color: '#E3A857',
    colorFamily: 'Yellow / Mustard',
    weight: 'Lightweight',
    notes: 'Extremely lightweight, high luster. Intended for slip dress lining or bias binding.',
    image: 'https://images.unsplash.com/photo-1606744824163-985d376605aa?auto=format&fit=crop&w=300&q=80',
    dateAdded: '2026-07-14'
  },
  {
    id: 'stash-3',
    name: 'Indigo Selvedge Denim',
    material: 'Denim',
    quantity: '4.0',
    unit: 'yards',
    width: '35"',
    color: '#1E293B',
    colorFamily: 'Blue / Teal',
    weight: 'Heavyweight',
    notes: 'Stiff, high-quality indigo denim. Ideal for worker jackets or rigid denim trousers.',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80',
    dateAdded: '2026-07-15'
  }
];

export default function FabricStashModal({
  isOpen,
  onClose
}) {
  const STORAGE_KEY = 'perfectfit_bureau_fabric_stash';

  // State management
  const [stash, setStash] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_STASH;
    } catch {
      return INITIAL_STASH;
    }
  });

  // Camera streaming states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  // Form input states
  const [fabricName, setFabricName] = useState('');
  const [fabricMaterial, setFabricMaterial] = useState('Linen');
  const [fabricQuantity, setFabricQuantity] = useState('2.5');
  const [fabricUnit, setFabricUnit] = useState('yards');
  const [fabricWidth, setFabricWidth] = useState('58"');
  const [fabricNotes, setFabricNotes] = useState('');
  const [fabricColor, setFabricColor] = useState('#ba6446');
  const [fabricWeight, setFabricWeight] = useState('Medium Weight');
  const [fabricColorFamily, setFabricColorFamily] = useState('Orange / Rust');

  // Tagging modal states
  const [isTaggingModalOpen, setIsTaggingModalOpen] = useState(false);
  const [taggingItemId, setTaggingItemId] = useState(null);
  const [selectedFabricType, setSelectedFabricType] = useState('Linen');
  const [selectedFabricColor, setSelectedFabricColor] = useState('Sage Green');

  const handleTagItemSave = () => {
    if (!taggingItemId) return;
    const colorObj = PREDEFINED_COLORS.find(c => c.name === selectedFabricColor) || { hex: '#ba6446' };
    const updated = stash.map(item => {
      if (item.id === taggingItemId) {
        return {
          ...item,
          material: selectedFabricType,
          color: colorObj.hex,
          colorFamily: getClosestColorFamily(colorObj.hex),
          tags: Array.from(new Set([...(item.tags || []), selectedFabricType, selectedFabricColor]))
        };
      }
      return item;
    });
    setStash(updated);
    setIsTaggingModalOpen(false);
    setTaggingItemId(null);
    if (window.showToast) {
      window.showToast(`Fabric card tagged successfully with ${selectedFabricType} (${selectedFabricColor})`, 'success', 'Card Tagged');
    }
  };

  // Dashboard filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState('All');
  const [weightFilter, setWeightFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');

  // Video reference for Camera API
  const videoRef = useRef(null);

  // Sync stash with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stash));
    } catch (e) {
      console.warn('Failed to persist fabric stash:', e);
    }
  }, [stash]);

  // Auto-detect color family when custom hex color is picked
  useEffect(() => {
    const detectedFamily = getClosestColorFamily(fabricColor);
    setFabricColorFamily(detectedFamily);
  }, [fabricColor]);

  // Clean up stream on modal close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  // Camera handling functions
  const startCamera = async () => {
    setCameraError(null);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      setCameraActive(true);

      // Delay slightly to ensure ref is attached
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      let errorMsg = 'Could not access device camera. Please make sure camera permissions are granted.';
      if (err.name === 'NotAllowedError') {
        errorMsg = 'Permission to access the camera was denied. Please update browser frame settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera hardware detected on this device.';
      }
      setCameraError(errorMsg);
      if (window.showToast) {
        window.showToast(errorMsg, 'error', 'Camera Error');
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      try {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext('2d');
        // Mirror effect correction if front camera is used (optional, we do straightforward draw)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        stopCamera();

        if (window.showToast) {
          window.showToast('Fabric snapshot captured successfully!', 'success', 'Photo Captured');
        }
      } catch (err) {
        console.error('Failed to capture frame:', err);
        setCameraError('An error occurred while snapping the image.');
      }
    }
  };

  // Standard fallback image upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result);
        if (window.showToast) {
          window.showToast('Fabric photo uploaded successfully!', 'success', 'Image Uploaded');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Quick select an elegant preset pattern image to save time
  const useSampleFabricImage = () => {
    const sampleImages = [
      'https://images.unsplash.com/photo-1606744824163-985d376605aa?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80',
      'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=300&q=80'
    ];
    const randomImg = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    setCapturedImage(randomImg);
    if (window.showToast) {
      window.showToast('Applied atelier high-resolution swatch image.', 'info');
    }
  };

  // Add Item to Stash
  const handleAddFabric = (e) => {
    e.preventDefault();

    const finalName = fabricName.trim() || `${fabricColor ? '' : ''}${fabricMaterial} Swatch`;

    // Ensure we have some image
    const finalImage = capturedImage || 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=300&q=80';

    const newItem = {
      id: `stash-${Date.now()}`,
      name: finalName,
      material: fabricMaterial,
      quantity: parseFloat(fabricQuantity) || 1.0,
      unit: fabricUnit,
      width: fabricWidth,
      color: fabricColor,
      colorFamily: fabricColorFamily,
      weight: fabricWeight,
      notes: fabricNotes.trim(),
      image: finalImage,
      dateAdded: new Date().toISOString().split('T')[0]
    };

    setStash(prev => [newItem, ...prev]);

    // Reset Form
    setFabricName('');
    setFabricMaterial('Linen');
    setFabricQuantity('2.5');
    setFabricWidth('58"');
    setFabricNotes('');
    setCapturedImage(null);
    setCameraError(null);
    setFabricWeight('Medium Weight');

    if (window.showToast) {
      window.showToast(`Added ${finalName} to your local sewing stash!`, 'success', 'Fabric Stashed');
    }
  };

  const handleDeleteFabric = (id, name) => {
    setStash(prev => prev.filter(item => item.id !== id));
    if (window.showToast) {
      window.showToast(`Removed "${name}" from your fabric stash directory.`, 'info', 'Item Removed');
    }
  };

  // Statistics calculation
  const totalYardage = stash
    .filter(item => item.unit === 'yards')
    .reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);

  const totalMeters = stash
    .filter(item => item.unit === 'meters')
    .reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);

  // Filter stash
  const filteredStash = stash.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.material.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.weight && item.weight.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.colorFamily && item.colorFamily.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMaterial = materialFilter === 'All' || item.material === materialFilter;

    const matchesWeight = weightFilter === 'All' ||
                          item.weight === weightFilter ||
                          (!item.weight && weightFilter === 'Medium Weight');

    const matchesColor = colorFilter === 'All' ||
                         item.colorFamily === colorFilter ||
                         (!item.colorFamily && colorFilter === 'Orange / Rust');

    return matchesSearch && matchesMaterial && matchesWeight && matchesColor;
  });

  // Export active stash as CSV
  const exportToCSV = () => {
    const itemsToExport = filteredStash;
    if (itemsToExport.length === 0) {
      if (window.showToast) {
        window.showToast('No fabrics match your current filters to export.', 'warning', 'No Data');
      } else {
        alert('No fabrics match your current filters to export.');
      }
      return;
    }

    // Prepare headers
    const headers = [
      'ID',
      'Fabric Name',
      'Material',
      'Quantity',
      'Unit',
      'Width',
      'Color HexCode',
      'Color Family',
      'Weight',
      'Notes',
      'Date Added'
    ];

    // Prepare rows
    const rows = itemsToExport.map(item => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.material.replace(/"/g, '""')}"`,
      item.quantity,
      item.unit,
      `"${item.width.replace(/"/g, '""')}"`,
      item.color,
      `"${(item.colorFamily || 'Other / Blend').replace(/"/g, '""')}"`,
      `"${(item.weight || 'Medium Weight').replace(/"/g, '""')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
      item.dateAdded || ''
    ]);

    // Build CSV string with UTF-8 BOM for Excel compatibility
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\r\n');

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sartorial_fabric_stash_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.showToast) {
        window.showToast(`Exported ${itemsToExport.length} fabrics to CSV successfully!`, 'success', 'Export Success');
      }
    } catch (err) {
      console.error('CSV Export Error:', err);
      if (window.showToast) {
        window.showToast('Failed to generate or download the CSV file.', 'error', 'Export Failed');
      }
    }
  };

  // Export active stash as printed PDF summary
  const exportToPDF = () => {
    const itemsToExport = filteredStash;
    if (itemsToExport.length === 0) {
      if (window.showToast) {
        window.showToast('No fabrics match your current filters to export.', 'warning', 'No Data');
      } else {
        alert('No fabrics match your current filters to export.');
      }
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const totalYdsEst = itemsToExport.reduce((acc, item) => {
      const qty = parseFloat(item.quantity) || 0;
      return acc + (item.unit === 'yards' ? qty : qty * 1.09361);
    }, 0);

    const totalMtrsEst = itemsToExport.reduce((acc, item) => {
      const qty = parseFloat(item.quantity) || 0;
      return acc + (item.unit === 'meters' ? qty : qty * 0.9144);
    }, 0);

    // Build Swiss-style highly refined print HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Perfect Fit Bureau - Fabric Inventory Summary</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap');

          body {
            font-family: "Inter", -apple-system, sans-serif;
            color: #1A1513;
            background: #FFFFFF;
            margin: 40px;
            font-size: 11px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .header {
            border-bottom: 2px solid #BA6446;
            padding-bottom: 16px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }

          .header-left h1 {
            font-family: "Playfair Display", Georgia, serif;
            font-size: 26px;
            font-weight: 700;
            color: #1A1513;
            margin: 0 0 4px 0;
          }

          .header-left p {
            font-size: 10px;
            font-family: "JetBrains Mono", monospace;
            color: #BA6446;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 700;
            margin: 0;
          }

          .header-right {
            text-align: right;
            font-family: "JetBrains Mono", monospace;
            font-size: 9.5px;
            color: #70625E;
            line-height: 1.6;
          }

          .stats-grid {
            display: grid;
            grid-template-cols: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 28px;
          }

          .stat-card {
            background: #FAF8F5;
            border: 1px solid #EAE3DF;
            border-radius: 6px;
            padding: 12px 16px;
          }

          .stat-label {
            font-family: "JetBrains Mono", monospace;
            font-size: 8.5px;
            text-transform: uppercase;
            color: #70625E;
            font-weight: 500;
            margin-bottom: 4px;
            display: block;
          }

          .stat-value {
            font-size: 15px;
            font-weight: 700;
            color: #BA6446;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }

          th {
            background: #1A1513;
            color: #FFFFFF;
            font-family: "JetBrains Mono", monospace;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 700;
            text-align: left;
            padding: 10px 12px;
            border: none;
          }

          td {
            padding: 12px;
            border-bottom: 1px solid #EAE3DF;
            font-size: 11.5px;
            vertical-align: top;
          }

          tr:nth-child(even) td {
            background: #FAF8F5/50;
          }

          .color-badge {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .color-circle {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 1px solid rgba(0, 0, 0, 0.15);
            display: inline-block;
          }

          .color-hex {
            font-family: "JetBrains Mono", monospace;
            font-size: 9.5px;
            font-weight: 700;
          }

          .material-tag {
            font-family: "JetBrains Mono", monospace;
            font-size: 8.5px;
            background: #EAE3DF;
            color: #1A1513;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 700;
            text-transform: uppercase;
            display: inline-block;
          }

          .notes {
            font-size: 10.5px;
            color: #5C4F4A;
            font-style: italic;
            margin-top: 5px;
            line-height: 1.4;
          }

          .badge-qty {
            font-family: "JetBrains Mono", monospace;
            font-weight: 700;
            color: #BA6446;
          }

          .footer {
            margin-top: auto;
            border-top: 1px solid #EAE3DF;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            font-family: "JetBrains Mono", monospace;
            font-size: 8.5px;
            color: #70625E;
          }

          @media print {
            body {
              margin: 20px;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>Perfect Fit Bureau</h1>
            <p>Fabric Inventory Summary Records</p>
          </div>
          <div class="header-right">
            <div>Print Date: ${currentDate}</div>
            <div>Scanned Records: ${itemsToExport.length} of ${stash.length} items</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Total Swatches</span>
            <span class="stat-value">${itemsToExport.length} Fabrics</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Est. Yardage</span>
            <span class="stat-value">${totalYdsEst.toFixed(1)} yds</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Est. Meters</span>
            <span class="stat-value">${totalMtrsEst.toFixed(1)} m</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Active Materials</span>
            <span class="stat-value" style="font-size: 12px; color: #4F4542;">
              ${Array.from(new Set(itemsToExport.map(i => i.material))).slice(0, 2).join(', ') || 'N/A'}
            </span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 6%;">No.</th>
              <th style="width: 32%;">Fabric Description &amp; Notes</th>
              <th style="width: 18%;">Material Type &amp; Weight</th>
              <th style="width: 14%;">Quantity</th>
              <th style="width: 12%;">Width</th>
              <th style="width: 18%;">Colorway</th>
            </tr>
          </thead>
          <tbody>
            ${itemsToExport.map((item, idx) => `
              <tr>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #70625E;">
                  ${String(idx + 1).padStart(2, '0')}
                </td>
                <td>
                  <strong style="font-size: 12px; color: #1A1513;">${item.name}</strong>
                  ${item.notes ? `<div class="notes">"${item.notes}"</div>` : ''}
                </td>
                <td>
                  <span class="material-tag">${item.material}</span>
                  <div style="font-size: 9px; color: #70625E; margin-top: 3px; font-family: 'JetBrains Mono', monospace;">
                    ${item.weight || 'Medium Weight'}
                  </div>
                </td>
                <td class="badge-qty">${item.quantity} ${item.unit}</td>
                <td style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px;">${item.width}</td>
                <td>
                  <div class="color-badge">
                    <span class="color-circle" style="background-color: ${item.color};"></span>
                    <span class="color-hex">${item.color.toUpperCase()}</span>
                  </div>
                  <div style="font-size: 9.5px; color: #70625E; margin-top: 3.5px;">
                    ${item.colorFamily || 'Other / Blend'}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <span>Perfect Fit Bureau Workroom Companion &bull; Confidential Inventory Summary</span>
          <span>End of Report</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    // Execute via hidden printing iframe
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.id = 'hidden-print-iframe';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(htmlContent);
      doc.close();

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();

          // Cleanup
          setTimeout(() => {
            if (document.getElementById('hidden-print-iframe')) {
              document.body.removeChild(iframe);
            }
          }, 8000);
        }, 500);
      };

      if (window.showToast) {
        window.showToast('Preparing your beautifully formatted printable PDF summary...', 'info', 'Generating PDF');
      }
    } catch (err) {
      console.error('PDF Generation Error:', err);
      if (window.showToast) {
        window.showToast('Failed to construct the PDF print preview.', 'error', 'Export Failed');
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs z-140 cursor-pointer"
            id="fabric-stash-backdrop"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 z-150 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 210 }}
              className="bg-[#FAF8F5] border border-sand-250 shadow-lux rounded-lg w-full max-w-4xl flex flex-col pointer-events-auto max-h-[92vh] overflow-hidden"
              id="fabric-stash-modal-panel"
            >
              {/* Header */}
              <div className="p-4 bg-white border-b border-sand-200/80 flex items-center justify-between shrink-0" id="fabric-stash-header">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-clay-50 border border-clay-100 flex items-center justify-center text-clay-700">
                    <Archive className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-bark-900 text-base leading-tight">My Atelier Fabric Stash</h3>
                    <p className="text-[9.5px] font-mono uppercase tracking-wider text-bark-450 mt-0.5">
                      Inventory, tag, and measure your physical materials
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-sand-100 text-bark-500 hover:text-bark-900 transition-all cursor-pointer border border-transparent hover:border-sand-200/50"
                  id="btn-close-fabric-stash"
                  aria-label="Close Fabric Stash"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Statistics Row */}
              <div className="px-5 py-3 bg-sand-100/70 border-b border-sand-200/50 grid grid-cols-3 gap-2 text-center shrink-0" id="fabric-stash-stats">
                <div className="bg-white border border-sand-150 p-2 rounded shadow-4xs">
                  <span className="text-[8.5px] font-mono text-bark-450 uppercase block font-bold">Total Stash Items</span>
                  <span className="text-sm font-bold font-mono text-bark-900">{stash.length} Fabrics</span>
                </div>
                <div className="bg-white border border-sand-150 p-2 rounded shadow-4xs">
                  <span className="text-[8.5px] font-mono text-bark-450 uppercase block font-bold">Total Yardage</span>
                  <span className="text-sm font-bold font-mono text-[#ba6446]">{totalYardage.toFixed(1)} yds</span>
                </div>
                <div className="bg-white border border-sand-150 p-2 rounded shadow-4xs">
                  <span className="text-[8.5px] font-mono text-bark-450 uppercase block font-bold">Total Meters</span>
                  <span className="text-sm font-bold font-mono text-clay-705">{totalMeters.toFixed(1)} m</span>
                </div>
              </div>

              {/* Scrollable Split Workspace */}
              <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-sand-200" id="fabric-stash-body">

                {/* LEFT COLUMN: ADD FABRIC FORM (5 Cols) */}
                <div className="lg:col-span-5 p-5 bg-white space-y-4.5 overflow-y-auto" id="fabric-stash-form-column">
                  <div className="border-b border-sand-150 pb-2">
                    <h4 className="font-serif font-bold text-bark-900 text-xs">Add New Fabric Swatch</h4>
                    <p className="text-[10px] text-bark-450">Capture a photo of your textile using your camera or upload an image file.</p>
                  </div>

                  {/* CAMERA / CAPTURE WIDGET */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                      1. Swatch Capture
                    </span>

                    {/* Camera display frame */}
                    <div className="relative aspect-video bg-bark-950 rounded border border-sand-250 overflow-hidden flex flex-col items-center justify-center text-white" id="camera-display-frame">
                      {cameraActive ? (
                        <>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          {/* Live guide grid overlays */}
                          <div className="absolute inset-0 border border-white/10 pointer-events-none" />
                          <div className="absolute top-1/3 left-0 right-0 border-t border-dashed border-white/20 pointer-events-none" />
                          <div className="absolute top-2/3 left-0 right-0 border-t border-dashed border-white/20 pointer-events-none" />
                          <div className="absolute left-1/3 top-0 bottom-0 border-l border-dashed border-white/20 pointer-events-none" />
                          <div className="absolute left-2/3 top-0 bottom-0 border-l border-dashed border-white/20 pointer-events-none" />

                          {/* Trigger buttons */}
                          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 px-3">
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[9.5px] uppercase font-bold rounded shadow cursor-pointer flex items-center gap-1"
                              id="btn-take-snapshot"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Capture Photo</span>
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-3 py-1.5 bg-bark-900 hover:bg-bark-955 text-sand-100 font-mono text-[9.5px] uppercase font-bold rounded cursor-pointer"
                              id="btn-stop-camera"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : capturedImage ? (
                        <div className="relative w-full h-full group">
                          <img
                            src={capturedImage}
                            alt="Captured fabric swatch"
                            className="w-full h-full object-cover"
                            id="captured-swatch-preview"
                          />
                          <div className="absolute inset-0 bg-bark-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="p-1.5 bg-white/90 hover:bg-white text-bark-900 rounded-full cursor-pointer"
                              title="Retake Photo"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCapturedImage(null)}
                              className="p-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-full cursor-pointer"
                              title="Remove Swatch Photo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="absolute bottom-2 left-2 bg-emerald-600/90 text-white font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded">
                            Photo Loaded
                          </span>
                        </div>
                      ) : (
                        <div className="p-4 text-center space-y-2.5">
                          <Camera className="w-8 h-8 text-bark-400 mx-auto" />
                          <p className="text-[10px] text-bark-300 max-w-xs leading-relaxed">
                            Position your fabric in clear lighting. Grant camera permissions if requested inside your browser.
                          </p>
                          <div className="flex flex-wrap gap-1.5 justify-center pt-1.5">
                            <button
                              type="button"
                              onClick={startCamera}
                              className="px-3 py-1.5 bg-bark-900 hover:bg-bark-955 text-sand-50 font-mono text-[9px] uppercase font-bold tracking-wider rounded cursor-pointer flex items-center gap-1.5"
                              id="btn-start-camera"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Start Camera</span>
                            </button>

                            <label className="px-3 py-1.5 bg-white border border-sand-250 hover:bg-sand-50 text-bark-800 font-mono text-[9px] uppercase font-bold tracking-wider rounded cursor-pointer flex items-center gap-1.5">
                              <Upload className="w-3 h-3 text-clay-605" />
                              <span>Upload File</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={useSampleFabricImage}
                              className="px-3 py-1.5 bg-clay-50/50 hover:bg-clay-50 text-clay-705 border border-clay-100 font-mono text-[9px] uppercase font-bold tracking-wider rounded cursor-pointer"
                              title="Use beautiful default textile sample"
                            >
                              Demo Photo
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {cameraError && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-700 text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{cameraError}</span>
                      </div>
                    )}
                  </div>

                  {/* FORM FIELDS */}
                  <form onSubmit={handleAddFabric} className="space-y-3.5" id="fabric-stash-inputs-form">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                      2. Fabric Metadata Tags
                    </span>

                    {/* Fabric Name */}
                    <div className="space-y-1">
                      <label htmlFor="input-fabric-name" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                        Fabric Descriptive Name:
                      </label>
                      <input
                        id="input-fabric-name"
                        type="text"
                        placeholder="e.g. Royal Blue Italian Linen Blend"
                        value={fabricName}
                        required
                        onChange={(e) => setFabricName(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-sand-250 text-xs px-3 py-2 rounded focus:outline-none focus:border-clay-500 text-bark-850"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Material Preset */}
                      <div className="space-y-1">
                        <label htmlFor="input-fabric-material" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                          Material Type:
                        </label>
                        <select
                          id="input-fabric-material"
                          value={fabricMaterial}
                          onChange={(e) => setFabricMaterial(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-sand-250 text-xs px-2 py-2 rounded focus:outline-none focus:border-clay-500 text-bark-850 font-sans"
                        >
                          {MATERIAL_PRESETS.map(preset => (
                            <option key={preset} value={preset}>{preset}</option>
                          ))}
                          <option value="Other / Blend">Other / Custom Blend</option>
                        </select>
                      </div>

                      {/* Fabric Width */}
                      <div className="space-y-1">
                        <label htmlFor="input-fabric-width" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                          Fabric Width:
                        </label>
                        <select
                          id="input-fabric-width"
                          value={fabricWidth}
                          onChange={(e) => setFabricWidth(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-sand-250 text-xs px-2 py-2 rounded focus:outline-none focus:border-clay-500 text-bark-850 font-sans"
                        >
                          <option value='58" - 60"'>58" - 60" (Wide-width)</option>
                          <option value='44" - 45"'>44" - 45" (Standard Dress)</option>
                          <option value='35"'>35" (Narrow / Vintage)</option>
                          <option value='72"'>72" (Extra Wide / Drapery)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Quantity */}
                      <div className="space-y-1">
                        <label htmlFor="input-fabric-qty" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                          Length / Quantity:
                        </label>
                        <div className="flex">
                          <input
                            id="input-fabric-qty"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={fabricQuantity}
                            required
                            onChange={(e) => setFabricQuantity(e.target.value)}
                            className="w-full bg-[#FAF8F5] border border-r-0 border-sand-250 text-xs px-3 py-2 rounded-l focus:outline-none focus:border-clay-500 text-bark-850 font-mono text-center"
                          />
                          <select
                            id="input-fabric-unit"
                            value={fabricUnit}
                            onChange={(e) => setFabricUnit(e.target.value)}
                            className="bg-sand-100 border border-sand-250 text-xs px-2.5 py-2 rounded-r focus:outline-none text-bark-850 font-mono"
                          >
                            <option value="yards">yds</option>
                            <option value="meters">meters</option>
                          </select>
                        </div>
                      </div>

                      {/* Swatch color picker */}
                      <div className="space-y-1">
                        <label htmlFor="input-fabric-color" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                          Dominant Hue:
                        </label>
                        <div className="flex items-center gap-1.5 h-[34px]">
                          <input
                            id="input-fabric-color"
                            type="color"
                            value={fabricColor}
                            onChange={(e) => setFabricColor(e.target.value)}
                            className="w-10 h-full border border-sand-250 rounded p-0 cursor-pointer bg-[#FAF8F5]"
                          />
                          <span className="text-[10px] font-mono uppercase text-bark-550 font-bold bg-sand-100 px-2 py-1 rounded">
                            {fabricColor}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Fabric Weight */}
                      <div className="space-y-1">
                        <label htmlFor="input-fabric-weight" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                          Fabric Weight:
                        </label>
                        <select
                          id="input-fabric-weight"
                          value={fabricWeight}
                          onChange={(e) => setFabricWeight(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-sand-250 text-xs px-2 py-2 rounded focus:outline-none focus:border-clay-500 text-bark-850 font-sans"
                        >
                          <option value="Lightweight">Lightweight (Voile, Silk, Lawn)</option>
                          <option value="Medium Weight">Medium Weight (Linen, Cotton, Rayon)</option>
                          <option value="Heavyweight">Heavyweight (Denim, Wool, Canvas)</option>
                        </select>
                      </div>

                      {/* Color Category */}
                      <div className="space-y-1">
                        <label htmlFor="input-fabric-color-family" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                          Color Category:
                        </label>
                        <select
                          id="input-fabric-color-family"
                          value={fabricColorFamily}
                          onChange={(e) => setFabricColorFamily(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-sand-250 text-xs px-2 py-2 rounded focus:outline-none focus:border-clay-500 text-bark-850 font-sans"
                        >
                          <option value="Red / Pink">Red / Pink</option>
                          <option value="Blue / Teal">Blue / Teal</option>
                          <option value="Green / Olive">Green / Olive</option>
                          <option value="Yellow / Mustard">Yellow / Mustard</option>
                          <option value="Orange / Rust">Orange / Rust</option>
                          <option value="Purple / Berry">Purple / Berry</option>
                          <option value="Beige / Brown">Beige / Brown</option>
                          <option value="Black / White / Gray">Black / White / Gray</option>
                        </select>
                      </div>
                    </div>

                    {/* Fabric Notes */}
                    <div className="space-y-1">
                      <label htmlFor="input-fabric-notes" className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-550 block">
                        Composition or Pattern Notes:
                      </label>
                      <textarea
                        id="input-fabric-notes"
                        rows={2}
                        placeholder="e.g. Purchased from Mood Fabrics. 100% pure linen grainline. Recommended for lightweight skirts."
                        value={fabricNotes}
                        onChange={(e) => setFabricNotes(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-sand-250 text-xs p-2.5 rounded focus:outline-none focus:border-clay-500 text-bark-850"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#ba6446] hover:bg-rose-900 text-white text-xs font-bold uppercase tracking-widest rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs active:scale-[0.99]"
                      id="btn-confirm-add-fabric"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register Swatch into Stash</span>
                    </button>
                  </form>
                </div>

                {/* RIGHT COLUMN: FABRIC STASH DASHBOARD (7 Cols) */}
                <div className="lg:col-span-7 p-5 flex flex-col overflow-hidden h-full" id="fabric-stash-dashboard-column">

                  {/* SEARCH & FILTERS */}
                  <div className="space-y-4 shrink-0 mb-4" id="fabric-dashboard-filters">
                    <div className="flex flex-col sm:flex-row gap-2.5 justify-between sm:items-center">
                      <div>
                        <h4 className="font-serif font-bold text-bark-900 text-sm">Active Fabric Inventory</h4>
                        <p className="text-[10px] text-bark-400">
                          {filteredStash.length} of {stash.length} fabrics matched your filters
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5" id="stash-export-controls-container">
                        {/* Export Buttons */}
                        <button
                          type="button"
                          onClick={exportToCSV}
                          className="px-2.5 py-1.5 text-[10px] font-mono text-[#ba6446] hover:text-white hover:bg-[#ba6446] bg-white rounded border border-[#ba6446]/25 transition-all cursor-pointer flex items-center gap-1 font-bold shadow-4xs active:scale-[0.98]"
                          title="Export current view as a CSV spreadsheet"
                          id="btn-export-stash-csv"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export CSV</span>
                        </button>

                        <button
                          type="button"
                          onClick={exportToPDF}
                          className="px-2.5 py-1.5 text-[10px] font-mono text-[#ba6446] hover:text-white hover:bg-[#ba6446] bg-white rounded border border-[#ba6446]/25 transition-all cursor-pointer flex items-center gap-1 font-bold shadow-4xs active:scale-[0.98]"
                          title="Generate high-resolution printable PDF Summary"
                          id="btn-export-stash-pdf"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Print PDF</span>
                        </button>

                        {/* Reset all button if filters are active */}
                        {(searchQuery || materialFilter !== 'All' || weightFilter !== 'All' || colorFilter !== 'All') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setMaterialFilter('All');
                              setWeightFilter('All');
                              setColorFilter('All');
                            }}
                            className="px-2.5 py-1.5 text-[10px] font-mono text-[#ba6446] hover:text-rose-950 bg-[#ba6446]/5 hover:bg-[#ba6446]/10 rounded border border-[#ba6446]/20 transition-all cursor-pointer flex items-center gap-1 font-bold active:scale-[0.98]"
                            id="btn-reset-all-filters"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Reset Filters</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-bark-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search fabrics by name, notes, weight, or color family..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-sand-250 text-xs pl-9 pr-14 py-2 rounded focus:outline-none focus:border-clay-500 text-bark-850 font-sans shadow-3xs"
                        id="input-fabric-search"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-2 text-[10px] font-mono font-bold text-[#ba6446] hover:text-rose-900 cursor-pointer"
                        >
                          CLEAR
                        </button>
                      )}
                    </div>

                    {/* Filter Category selectors (Material, Weight) */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Material filter */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-bark-450 uppercase font-bold block">1. Material Type:</span>
                        <select
                          value={materialFilter}
                          onChange={(e) => setMaterialFilter(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-[11px] px-2 py-1.5 rounded focus:outline-none font-sans text-bark-850 shadow-4xs"
                          id="select-material-filter"
                        >
                          <option value="All">All Materials</option>
                          {MATERIAL_PRESETS.map(preset => (
                            <option key={preset} value={preset}>{preset}</option>
                          ))}
                          <option value="Other / Blend">Other / Blend</option>
                        </select>
                      </div>

                      {/* Weight filter */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-bark-450 uppercase font-bold block">2. Fabric Weight:</span>
                        <select
                          value={weightFilter}
                          onChange={(e) => setWeightFilter(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-[11px] px-2 py-1.5 rounded focus:outline-none font-sans text-bark-850 shadow-4xs"
                          id="select-weight-filter"
                        >
                          <option value="All">All Weights</option>
                          <option value="Lightweight">Lightweight</option>
                          <option value="Medium Weight">Medium Weight</option>
                          <option value="Heavyweight">Heavyweight</option>
                        </select>
                      </div>
                    </div>

                    {/* Color Family filter */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-mono text-bark-450 uppercase font-bold block">3. Dominant Color Hue:</span>
                      <div className="flex flex-wrap gap-1.5" id="color-filter-palette-bar">
                        {COLOR_FAMILIES_PRESETS.map((fam) => {
                          const isActive = colorFilter === fam.name;
                          return (
                            <button
                              key={fam.name}
                              type="button"
                              onClick={() => setColorFilter(fam.name)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border cursor-pointer ${
                                isActive
                                  ? 'bg-bark-900 text-white border-bark-900 shadow-3xs scale-[1.02]'
                                  : 'bg-white text-bark-600 border-sand-200 hover:border-sand-300 hover:bg-sand-50/50'
                              }`}
                              title={`Filter by ${fam.name}`}
                              id={`color-filter-btn-${fam.name.replace(/\s+/g, '')}`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                                style={{ background: fam.color }}
                              />
                              <span>{fam.name === 'All' ? 'All Colors' : fam.name.split(' / ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* INVENTORY GRID */}
                  <div className="flex-1 overflow-y-auto pr-1" id="fabric-dashboard-grid-container">
                    {filteredStash.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredStash.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white border border-sand-200 rounded-[4px] shadow-3xs flex flex-col justify-between overflow-hidden relative"
                            id={`fabric-stash-card-${item.id}`}
                          >
                            {/* Card Image */}
                            <div className="relative aspect-video bg-sand-100 overflow-hidden shrink-0 border-b border-sand-150">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              {/* Swatch color bubble in corner */}
                              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs px-2 py-1 rounded shadow-4xs border border-sand-200">
                                <span
                                  className="w-3 h-3 rounded-full border border-sand-300"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="font-mono text-[8px] font-bold text-bark-850 uppercase">
                                  {item.color}
                                </span>
                              </div>

                              {/* Material Badge */}
                              <span className="absolute bottom-2.5 left-2.5 bg-bark-900/90 text-sand-50 font-mono text-[8.5px] uppercase tracking-wider font-bold px-2 py-0.5 rounded shadow-4xs">
                                {item.material}
                              </span>

                              {/* Weight Badge */}
                              <span className="absolute bottom-2.5 right-2.5 bg-white/95 text-bark-800 font-mono text-[8.5px] uppercase tracking-wider font-bold px-2 py-0.5 rounded shadow-4xs border border-sand-200">
                                {item.weight || 'Medium Weight'}
                              </span>
                            </div>

                            {/* Details */}
                            <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                              <div className="space-y-1">
                                <h5 className="font-serif font-bold text-bark-900 text-xs leading-snug">
                                  {item.name}
                                </h5>
                                {item.notes && (
                                  <p className="text-[10px] text-bark-500 font-sans line-clamp-2 leading-relaxed">
                                    {item.notes}
                                  </p>
                                )}
                              </div>

                              {/* Attributes Matrix */}
                              <div className="grid grid-cols-3 gap-1.5 bg-sand-50/75 p-2 rounded text-[10px] font-mono text-bark-600 border border-sand-150">
                                <div className="space-y-0.5 text-center">
                                  <span className="text-[7.5px] text-bark-400 block uppercase">Yardage</span>
                                  <span className="font-bold text-bark-850">{item.quantity} {item.unit}</span>
                                </div>
                                <div className="space-y-0.5 text-center border-x border-sand-200">
                                  <span className="text-[7.5px] text-bark-400 block uppercase">Width</span>
                                  <span className="font-bold text-bark-850">{item.width}</span>
                                </div>
                                <div className="space-y-0.5 text-center">
                                  <span className="text-[7.5px] text-bark-400 block uppercase">Color Family</span>
                                  <span className="font-bold text-bark-850 leading-none truncate block max-w-full" title={item.colorFamily || 'Orange / Rust'}>
                                    {(item.colorFamily || 'Orange / Rust').split(' / ')[0]}
                                  </span>
                                </div>
                              </div>

                              {/* Actions footer */}
                              <div className="flex items-center justify-between border-t border-sand-100 pt-2 text-[10px] text-bark-450 font-mono">
                                <span>Added: {item.dateAdded}</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const existingColor = PREDEFINED_COLORS.find(c => c.hex.toLowerCase() === item.color.toLowerCase())?.name || 'Sage Green';
                                      setTaggingItemId(item.id);
                                      setSelectedFabricType(item.material || 'Linen');
                                      setSelectedFabricColor(existingColor);
                                      setIsTaggingModalOpen(true);
                                    }}
                                    className="text-clay-650 hover:text-clay-750 font-bold uppercase tracking-wider text-[9px] cursor-pointer flex items-center gap-0.5 hover:bg-clay-50 px-1.5 py-0.5 rounded transition-all"
                                    title="Tag fabric card properties"
                                  >
                                    <Tag className="w-3 h-3 text-clay-600" />
                                    <span>Tag Card</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFabric(item.id, item.name)}
                                    className="text-rose-600 hover:text-rose-700 font-bold uppercase tracking-wider text-[9px] cursor-pointer flex items-center gap-0.5 hover:bg-rose-50 px-1.5 py-0.5 rounded"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white border border-sand-200 border-dashed rounded-[4px] p-8 text-center space-y-3" id="fabric-inventory-empty">
                        <Archive className="w-9 h-9 text-bark-300 mx-auto" />
                        <div className="space-y-1">
                          <h4 className="font-serif font-bold text-bark-900 text-sm">No Fabrics Match Queries</h4>
                          <p className="text-xs text-bark-450 max-w-xs mx-auto leading-relaxed font-sans">
                            {stash.length === 0
                              ? "Your digital stash list is empty. Add your physical cotton, wool, linen or silk cuts in the left pane."
                              : "No fabrics in your inventory matched your search terms or filter constraints."}
                          </p>
                        </div>
                        {stash.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setMaterialFilter('All');
                              setWeightFilter('All');
                              setColorFilter('All');
                            }}
                            className="px-3.5 py-1.5 bg-[#ba6446] hover:bg-rose-900 text-white text-[10.5px] font-semibold rounded cursor-pointer transition-colors"
                          >
                            Reset Filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-white border-t border-sand-200 flex justify-between items-center shrink-0" id="fabric-stash-footer">
                <span className="text-[10px] text-bark-400 font-serif italic flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-clay-605" />
                  <span>Use captured stash yardage directly when using the fabric calculator inside pattern pages.</span>
                </span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-sand-100 hover:bg-sand-200 text-bark-850 rounded text-xs font-semibold cursor-pointer"
                  id="btn-close-fabric-stash-footer"
                  type="button"
                >
                  Close Dashboard
                </button>
              </div>

            </motion.div>
          </div>

          {/* TAGGING SUB-MODAL */}
          <AnimatePresence>
            {isTaggingModalOpen && (
              <div className="fixed inset-0 z-200 overflow-y-auto flex items-center justify-center p-4 sm:p-6" id="card-tagging-modal">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsTaggingModalOpen(false)}
                  className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs z-190 cursor-pointer"
                />

                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  className="bg-[#FAF8F5] border border-sand-250 shadow-lux rounded-lg w-full max-w-md p-6 z-200 relative space-y-5 pointer-events-auto"
                >
                  <div className="flex items-center justify-between border-b border-sand-150 pb-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-clay-605" />
                      <h4 className="font-serif font-bold text-bark-900 text-sm">Tag Fabric Card</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTaggingModalOpen(false)}
                      className="p-1 rounded-full hover:bg-sand-100 text-bark-450 hover:text-bark-900 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-bark-600 block font-bold">Fabric Type</label>
                      <select
                        value={selectedFabricType}
                        onChange={(e) => setSelectedFabricType(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                      >
                        {MATERIAL_PRESETS.map((material) => (
                          <option key={material} value={material}>
                            {material}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-bark-600 block font-bold">Color Swatch</label>
                      <select
                        value={selectedFabricColor}
                        onChange={(e) => setSelectedFabricColor(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                      >
                        {PREDEFINED_COLORS.map((color) => (
                          <option key={color.name} value={color.name}>
                            {color.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-sand-50 border border-sand-200 rounded p-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[8px] font-mono text-bark-450 uppercase block">Selected Swatch Preview</span>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-sand-300 shadow-3xs block"
                            style={{ backgroundColor: PREDEFINED_COLORS.find(c => c.name === selectedFabricColor)?.hex || '#ba6446' }}
                          />
                          <span className="text-xs font-mono font-bold text-bark-800 uppercase">
                            {selectedFabricColor} ({PREDEFINED_COLORS.find(c => c.name === selectedFabricColor)?.hex || '#ba6446'})
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-clay-50 border border-clay-100 text-clay-700 px-2 py-0.5 rounded uppercase">
                        {selectedFabricType}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-sand-150">
                    <button
                      type="button"
                      onClick={() => setIsTaggingModalOpen(false)}
                      className="px-3.5 py-1.5 border border-sand-250 hover:bg-sand-50 text-bark-750 rounded text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleTagItemSave}
                      className="px-3.5 py-1.5 bg-clay-605 hover:bg-clay-750 text-white rounded text-xs font-bold cursor-pointer transition-all shadow-3xs hover:shadow-2xs active:scale-95 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Tags</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
