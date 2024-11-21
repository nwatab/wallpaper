window.onload = function () {
  const canvas = document.getElementById('patternCanvas');
  const ctx = canvas.getContext('2d');

  // canvasのサイズをmainContentに合わせる
  const mainContent = document.getElementById('mainContent');
  canvas.width = mainContent.clientWidth;
  canvas.height = mainContent.clientHeight;

  window.addEventListener('resize', function () {
    canvas.width = mainContent.clientWidth;
    canvas.height = mainContent.clientHeight;
    drawPattern();
  });

  let selectedMotif = 'circle';
  let selectedGroup = 'p1';

  // モチーフのプレビューを初期化
  const motifPreviews = document.querySelectorAll('.motifPreview');
motifPreviews.forEach(preview => {
  const motif = preview.getAttribute('data-motif');
  const previewCanvas = preview.querySelector('canvas');
  const previewCtx = previewCanvas.getContext('2d');

  // プレビュー用のモチーフを描画
  drawMotifPreview(previewCtx, motif);

  // クリックイベントを追加
  preview.addEventListener('click', function () {
    selectedMotif = motif;
    motifPreviews.forEach(p => p.classList.remove('selected'));
    preview.classList.add('selected');
    drawPattern();
    updateGroupPreviews(); // Add this line to update group previews
  });

  // デフォルトの選択
  if (motif === selectedMotif) {
    preview.classList.add('selected');
  }
});

  // 壁紙群のプレビューを初期化
  const groupPreviews = document.querySelectorAll('.groupPreview');
  groupPreviews.forEach(preview => {
    const group = preview.getAttribute('data-group');
    const previewCanvas = preview.querySelector('canvas');
    const previewCtx = previewCanvas.getContext('2d');
  
    // プレビュー用の壁紙群を描画
    drawGroupPreview(previewCtx, group);
  
    // クリックイベントを追加
    preview.addEventListener('click', function () {
      selectedGroup = group;
      groupPreviews.forEach(p => p.classList.remove('selected'));
      preview.classList.add('selected');
      drawPattern();
    });
  
    // デフォルトの選択
    if (group === selectedGroup) {
      preview.classList.add('selected');
    }
  });

  function updateGroupPreviews() {
    groupPreviews.forEach(preview => {
      const group = preview.getAttribute('data-group');
      const previewCanvas = preview.querySelector('canvas');
      const previewCtx = previewCanvas.getContext('2d');
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      drawGroupPreview(previewCtx, group);
    });
  }

  function drawMotifPreview(ctx, motif) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.fillStyle = 'blue';

    switch (motif) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, 2 * Math.PI);
        ctx.fill();
        break;
      case 'square':
        ctx.fillRect(-10, -10, 20, 20);
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(10, 10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();
        break;
      case 'seigaiha':
        drawSeigaihaPreview(ctx);
        break;
      case 'stripes':
        drawStripesPreview(ctx);
        break;
      case 'tartan':
        drawTartanPreview(ctx);
        break;
      // 他のモチーフを追加
    }

    ctx.restore();
  }

  function drawGroupPreview(ctx, group) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.scale(0.5, 0.5); // プレビュー用に縮小
    switch (group) {
      case 'p1':
        drawP1(ctx);
        break;
      case 'p2':
        drawP2(ctx);
        break;
      case 'pm':
        drawPM(ctx);
        break;
      case 'pg':
        drawPG(ctx);
        break;
      case 'cm':
        drawCM(ctx);
        break;
      case 'pmm':
        drawPMM(ctx);
        break;
      case 'pmg':
        drawPMG(ctx);
        break;
      case 'pgg':
        drawPGG(ctx);
        break;
      case 'cmm':
        drawCMM(ctx);
        break;
      case 'p4':
        drawP4(ctx);
        break;
      case 'p4m':
        drawP4M(ctx);
        break;
      case 'p4g':
        drawP4G(ctx);
        break;
      case 'p3':
        drawP3(ctx);
        break;
      case 'p3m1':
        drawP3M1(ctx);
        break;
      case 'p31m':
        drawP31M(ctx);
        break;
      case 'p6':
        drawP6(ctx);
        break;
      case 'p6m':
        drawP6M(ctx);
        break;
      default:
        break;
    }
    ctx.restore();
  }
  

  // モチーフの描画関数
  function drawMotif(x, y, ctx) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'blue';

    switch (selectedMotif) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, 2 * Math.PI);
        ctx.fill();
        break;
      case 'square':
        ctx.fillRect(-10, -10, 20, 20);
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(10, 10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();
        break;
      case 'seigaiha':
        drawSeigaihaMotif(ctx);
        break;
      case 'stripes':
        drawStripesMotif(ctx);
        break;
      case 'tartan':
        drawTartanMotif(ctx);
        break;
      // 他のモチーフを追加
    }

    ctx.restore();
  }


  // 青海波のプレビューを描画
  function drawSeigaihaPreview(ctx) {
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 5 + i * 5, Math.PI, 2 * Math.PI);
      ctx.stroke();
    }
  }

  // 青海波のモチーフを描画
  function drawSeigaihaMotif(ctx) {
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + i * 5, Math.PI, 2 * Math.PI);
      ctx.stroke();
    }
  }

  // ストライプのプレビューを描画
  function drawStripesPreview(ctx) {
    ctx.fillStyle = 'blue';
    for (let i = -25; i <= 25; i += 10) {
      ctx.fillRect(i, -25, 5, 50);
    }
  }

  // ストライプのモチーフを描画
  function drawStripesMotif(ctx) {
    ctx.fillStyle = 'blue';
    for (let i = -25; i <= 25; i += 10) {
      ctx.fillRect(i, -25, 5, 50);
    }
  }

  // タータンチェックのプレビューを描画
  function drawTartanPreview(ctx) {
    // 縦線
    ctx.fillStyle = 'red';
    for (let i = -25; i <= 25; i += 10) {
      ctx.fillRect(i - 2, -25, 4, 50);
    }
    // 横線
    ctx.fillStyle = 'green';
    for (let i = -25; i <= 25; i += 10) {
      ctx.fillRect(-25, i - 2, 50, 4);
    }
  }

  // タータンチェックのモチーフを描画
  function drawTartanMotif(ctx) {
    // 縦線
    ctx.fillStyle = 'red';
    for (let i = -25; i <= 25; i += 10) {
      ctx.fillRect(i - 2, -25, 4, 50);
    }
    // 横線
    ctx.fillStyle = 'green';
    for (let i = -25; i <= 25; i += 10) {
      ctx.fillRect(-25, i - 2, 50, 4);
    }
  }

  // パターンを描画
  function drawPattern() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    switch (selectedGroup) {
      case 'p1':
        drawP1(ctx);
        break;
      case 'p2':
        drawP2(ctx);
        break;
      case 'pm':
        drawPM(ctx);
        break;
      case 'pg':
        drawPG(ctx);
        break;
      case 'cm':
        drawCM(ctx);
        break;
      case 'pmm':
        drawPMM(ctx);
        break;
      case 'pmg':
        drawPMG(ctx);
        break;
      case 'pgg':
        drawPGG(ctx);
        break;
      case 'cmm':
        drawCMM(ctx);
        break;
      case 'p4':
        drawP4(ctx);
        break;
      case 'p4m':
        drawP4M(ctx);
        break;
      case 'p4g':
        drawP4G(ctx);
        break;
      case 'p3':
        drawP3(ctx);
        break;
      case 'p3m1':
        drawP3M1(ctx);
        break;
      case 'p31m':
        drawP31M(ctx);
        break;
      case 'p6':
        drawP6(ctx);
        break;
      case 'p6m':
        drawP6M(ctx);
        break;
      default:
        break;
    }
  }

  // 各壁紙群の描画関数

  // P1群：単純な平行移動
  function drawP1(drawCtx) {
    const dx = 50;
    const dy = 50;

    for (let x = 0; x < drawCtx.canvas.width; x += dx) {
      for (let y = 0; y < drawCtx.canvas.height; y += dy) {
        drawMotif(x, y, drawCtx);
      }
    }
  }

  // P2群：平行移動と180度回転
  function drawP2(drawCtx) {
    const dx = 100;
    const dy = 100;

    for (let x = 0; x < drawCtx.canvas.width; x += dx) {
      for (let y = 0; y < drawCtx.canvas.height; y += dy) {
        drawCtx.save();
        drawCtx.translate(x + dx / 2, y + dy / 2);
        for (let i = 0; i < 2; i++) {
          drawCtx.rotate(Math.PI * i);
          drawMotif(0, 0, drawCtx);
        }
        drawCtx.restore();
      }
    }
  }

  // PM群：平行移動と垂直鏡映
  function drawPM(drawCtx) {
    const dx = 100;
    const dy = 50;

    for (let x = 0; x < drawCtx.canvas.width; x += dx) {
      for (let y = 0; y < drawCtx.canvas.height; y += dy) {
        // 元のモチーフ
        drawCtx.save();
        drawCtx.translate(x, y);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();

        // 垂直鏡映
        drawCtx.save();
        drawCtx.translate(x + dx, y);
        drawCtx.scale(-1, 1);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();
      }
    }
  }

  // PG群：平行移動と滑り反射
  function drawPG(drawCtx) {
    const dx = 100;
    const dy = 50;

    for (let x = 0; x < drawCtx.canvas.width + dx; x += dx / 2) {
      for (let y = 0; y < drawCtx.canvas.height + dy; y += dy) {
        drawCtx.save();
        drawCtx.translate(x, y);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();

        drawCtx.save();
        drawCtx.translate(x + dx / 2, y + dy);
        drawCtx.scale(1, -1);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();
      }
    }
  }

  // CM群：平行移動と中心鏡映
  function drawCM(drawCtx) {
    const dx = 100;
    const dy = 50;

    for (let x = 0; x < drawCtx.canvas.width + dx; x += dx / 2) {
      for (let y = 0; y < drawCtx.canvas.height + dy; y += dy) {
        drawCtx.save();
        drawCtx.translate(x, y);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();

        drawCtx.save();
        drawCtx.translate(x + dx / 2, y);
        drawCtx.scale(-1, 1);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();
      }
    }
  }

  // PMM群：平行移動と水平・垂直の鏡映
  function drawPMM(drawCtx) {
    const dx = 100;
    const dy = 100;

    for (let x = 0; x <= drawCtx.canvas.width; x += dx) {
      for (let y = 0; y <= drawCtx.canvas.height; y += dy) {
        const positions = [
          { sx: 1, sy: 1 },
          { sx: -1, sy: 1 },
          { sx: 1, sy: -1 },
          { sx: -1, sy: -1 }
        ];

        positions.forEach(pos => {
          drawCtx.save();
          drawCtx.translate(x + dx / 2, y + dy / 2);
          drawCtx.scale(pos.sx, pos.sy);
          drawMotif(0, 0, drawCtx);
          drawCtx.restore();
        });
      }
    }
  }

  // PMG群：平行移動、垂直鏡映、水平滑り反射
  function drawPMG(drawCtx) {
    const dx = 100;
    const dy = 100;

    for (let x = 0; x <= drawCtx.canvas.width + dx; x += dx) {
      for (let y = 0; y <= drawCtx.canvas.height + dy; y += dy) {
        // 垂直鏡映
        drawCtx.save();
        drawCtx.translate(x, y);
        drawMotif(0, 0, drawCtx);
        drawCtx.scale(-1, 1);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();

        // 水平滑り反射
        drawCtx.save();
        drawCtx.translate(x + dx / 2, y + dy / 2);
        drawCtx.scale(1, -1);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();
      }
    }
  }

  // PGG群：平行移動、180度回転、滑り反射
  function drawPGG(drawCtx) {
    const dx = 100;
    const dy = 100;

    for (let x = 0; x <= drawCtx.canvas.width + dx; x += dx) {
      for (let y = 0; y <= drawCtx.canvas.height + dy; y += dy) {
        // 180度回転
        drawCtx.save();
        drawCtx.translate(x + dx / 2, y + dy / 2);
        for (let i = 0; i < 2; i++) {
          drawCtx.rotate(Math.PI * i);
          drawMotif(0, 0, drawCtx);
        }
        drawCtx.restore();

        // 滑り反射
        drawCtx.save();
        drawCtx.translate(x, y + dy / 2);
        drawCtx.scale(-1, 1);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();
      }
    }
  }

  // CMM群：平行移動、回転、鏡映
  function drawCMM(drawCtx) {
    const dx = 100;
    const dy = 100;

    for (let x = 0; x <= drawCtx.canvas.width; x += dx) {
      for (let y = 0; y <= drawCtx.canvas.height; y += dy) {
        const positions = [
          { sx: 1, sy: 1 },
          { sx: -1, sy: 1 },
          { sx: 1, sy: -1 },
          { sx: -1, sy: -1 }
        ];

        positions.forEach(pos => {
          drawCtx.save();
          drawCtx.translate(x + dx / 2, y + dy / 2);
          drawCtx.scale(pos.sx, pos.sy);
          drawMotif(0, 0, drawCtx);
          drawCtx.restore();
        });

        // 180度回転
        drawCtx.save();
        drawCtx.translate(x + dx / 2, y + dy / 2);
        drawCtx.rotate(Math.PI);
        drawMotif(0, 0, drawCtx);
        drawCtx.restore();
      }
    }
  }

  // P4群：90度回転対称
  function drawP4(drawCtx) {
    const dx = 100;
    const dy = 100;

    for (let x = 0; x <= drawCtx.canvas.width; x += dx) {
      for (let y = 0; y <= drawCtx.canvas.height; y += dy) {
        drawCtx.save();
        drawCtx.translate(x + dx / 2, y + dy / 2);
        for (let i = 0; i < 4; i++) {
          drawCtx.rotate((Math.PI / 2) * i);
          drawMotif(0, -dy / 4, drawCtx);
        }
        drawCtx.restore();
      }
    }
  }

  // P4M群：90度回転と鏡映
  function drawP4M(drawCtx) {
    const dx = 100;
    const dy = 100;

    for (let x = 0; x <= drawCtx.canvas.width; x += dx) {
      for (let y = 0; y <= drawCtx.canvas.height; y += dy) {
        drawCtx.save();
        drawCtx.translate(x + dx / 2, y + dy / 2);
        // 90度回転と鏡映
        for (let i = 0; i < 4; i++) {
          drawCtx.rotate((Math.PI / 2) * i);
          drawMotif(0, -dy / 4, drawCtx);
          drawCtx.scale(-1, 1);
          drawMotif(0, -dy / 4, drawCtx);
          drawCtx.scale(-1, 1); // 元に戻す
        }
        drawCtx.restore();
      }
    }
  }

  // P4G群：90度回転と対角鏡映
  function drawP4G(drawCtx) {
    const dx = 100;
    const dy = 100;

    for (let x = 0; x <= drawCtx.canvas.width; x += dx) {
      for (let y = 0; y <= drawCtx.canvas.height; y += dy) {
        drawCtx.save();
        drawCtx.translate(x + dx / 2, y + dy / 2);
        // 90度回転
        for (let i = 0; i < 4; i++) {
          drawCtx.rotate((Math.PI / 2) * i);
          drawMotif(0, -dy / 4, drawCtx);
        }
        // 対角線での鏡映
        drawCtx.scale(1, -1);
        for (let i = 0; i < 4; i++) {
          drawCtx.rotate((Math.PI / 2) * i);
          drawMotif(0, -dy / 4, drawCtx);
        }
        drawCtx.restore();
      }
    }
  }

  // P3群：120度回転対称
  function drawP3(drawCtx) {
    const dx = 100;
    const dy = Math.sqrt(3) / 2 * dx;

    for (let y = 0; y <= drawCtx.canvas.height + dy; y += dy) {
      for (let x = 0; x <= drawCtx.canvas.width + dx; x += dx) {
        const xOffset = (Math.floor(y / dy) % 2 === 0) ? 0 : dx / 2;
        drawCtx.save();
        drawCtx.translate(x + xOffset, y);
        for (let i = 0; i < 3; i++) {
          drawCtx.rotate((2 * Math.PI / 3) * i);
          drawMotif(0, -dy / 2, drawCtx);
        }
        drawCtx.restore();
      }
    }
  }

  // P3M1群：120度回転と鏡映
  function drawP3M1(drawCtx) {
    const dx = 100;
    const dy = Math.sqrt(3) / 2 * dx;

    for (let y = 0; y <= drawCtx.canvas.height + dy; y += dy) {
      for (let x = 0; x <= drawCtx.canvas.width + dx; x += dx) {
        const xOffset = (Math.floor(y / dy) % 2 === 0) ? 0 : dx / 2;
        drawCtx.save();
        drawCtx.translate(x + xOffset, y);
        for (let i = 0; i < 3; i++) {
          drawCtx.rotate((2 * Math.PI / 3) * i);
          drawMotif(0, -dy / 2, drawCtx);
          drawCtx.scale(-1, 1);
          drawMotif(0, -dy / 2, drawCtx);
          drawCtx.scale(-1, 1); // 元に戻す
        }
        drawCtx.restore();
      }
    }
  }

  // P31M群：別の120度回転と鏡映の組み合わせ
  function drawP31M(drawCtx) {
    const dx = 100;
    const dy = Math.sqrt(3) / 2 * dx;

    for (let y = 0; y <= drawCtx.canvas.height + dy; y += dy) {
      for (let x = 0; x <= drawCtx.canvas.width + dx; x += dx) {
        const xOffset = (Math.floor(y / dy) % 2 === 0) ? 0 : dx / 2;
        drawCtx.save();
        drawCtx.translate(x + xOffset, y);
        for (let i = 0; i < 3; i++) {
          drawCtx.rotate((2 * Math.PI / 3) * i);
          drawMotif(0, -dy / 2, drawCtx);
        }
        // 鏡映
        drawCtx.scale(-1, 1);
        for (let i = 0; i < 3; i++) {
          drawCtx.rotate((2 * Math.PI / 3) * i);
          drawMotif(0, -dy / 2, drawCtx);
        }
        drawCtx.restore();
      }
    }
  }

  // P6群：60度回転対称
  function drawP6(drawCtx) {
    const dx = 100;
    const dy = Math.sqrt(3) / 2 * dx;

    for (let y = 0; y <= drawCtx.canvas.height + dy; y += dy) {
      for (let x = 0; x <= drawCtx.canvas.width + dx; x += dx) {
        const xOffset = (Math.floor(y / dy) % 2 === 0) ? 0 : dx / 2;
        drawCtx.save();
        drawCtx.translate(x + xOffset, y);
        for (let i = 0; i < 6; i++) {
          drawCtx.rotate((Math.PI / 3) * i);
          drawMotif(0, -dy / 2, drawCtx);
        }
        drawCtx.restore();
      }
    }
  }

  // P6M群：60度回転と鏡映
  function drawP6M(drawCtx) {
    const dx = 100;
    const dy = Math.sqrt(3) / 2 * dx;

    for (let y = 0; y <= drawCtx.canvas.height + dy; y += dy) {
      for (let x = 0; x <= drawCtx.canvas.width + dx; x += dx) {
        const xOffset = (Math.floor(y / dy) % 2 === 0) ? 0 : dx / 2;
        drawCtx.save();
        drawCtx.translate(x + xOffset, y);
        for (let i = 0; i < 6; i++) {
          drawCtx.rotate((Math.PI / 3) * i);
          drawMotif(0, -dy / 2, drawCtx);
          drawCtx.scale(-1, 1);
          drawMotif(0, -dy / 2, drawCtx);
          drawCtx.scale(-1, 1); // 元に戻す
        }
        drawCtx.restore();
      }
    }
  }

  // 初期描画
  drawPattern();
};
