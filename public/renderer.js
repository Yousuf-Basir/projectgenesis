const TILE_COLORS = {
  EMPTY: "#081922",
  FOOD: "#7dff72",
  WALL: "#e2edf0"
};

const RESOURCE_COLORS = {
  GREEN: "#9dff84",
  BLUE: "#70b6ff",
  RED: "#ff8b76"
};

const COURIER_COLORS = { GATE_READY: "#75eaff" };

const CELL_SIZE = 13;

function phenotype(organism) {
  const capabilities = new Map(organism.capabilities.map((capability) => [capability.prime, capability.power]));
  const energyLightness = 42 + Math.min(22, organism.energy / 105 * 22);
  const amplified = [...capabilities.values()].reduce((total, power) => total + Math.max(0, power - 1), 0);

  return {
    // Orange remains the stable meaning for "living organism"; genetic changes appear as generated markings.
    color: `hsl(30, 88%, ${energyLightness}%)`,
    hasPersistence: capabilities.has(13),
    hasSpatialAwareness: capabilities.has(17),
    hasSignal: capabilities.has(19),
    amplified
  };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.pixelRatio = window.devicePixelRatio || 1;
    this.lastSnapshot = null;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    if (this.lastSnapshot) {
      this.render(this.lastSnapshot);
    }
  }

  sizeCanvas(world) {
    const width = world.width * CELL_SIZE;
    const height = world.height * CELL_SIZE;

    if (this.canvas.style.width !== `${width}px` || this.canvas.style.height !== `${height}px`) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.canvas.width = Math.floor(width * this.pixelRatio);
      this.canvas.height = Math.floor(height * this.pixelRatio);
      this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    }

    return { width, height };
  }

  render(snapshot) {
    this.lastSnapshot = snapshot;
    const { world, organisms, controls, markers, bonds = [], facets = [], signal: signalSettings = {}, bonding: bondSettings = {}, facetCapital = {}, collectiveWork = {} } = snapshot;
    const { width, height } = this.sizeCanvas(world);
    const cellSize = CELL_SIZE;
    const offsetX = 0;
    const offsetY = 0;

    this.context.clearRect(0, 0, width, height);

    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        this.context.fillStyle = TILE_COLORS.EMPTY;
        this.context.fillRect(
          offsetX + x * cellSize,
          offsetY + y * cellSize,
          cellSize,
          cellSize
        );

        const field=snapshot.morphologyEnvironment;
        if(field) {
          const row=Math.min(field.size-1,Math.floor(y/world.height*field.size));
          const column=Math.min(field.size-1,Math.floor(x/world.width*field.size));
          this.context.fillStyle=`rgba(95,185,210,${field.reward[row][column]*0.08})`;
          this.context.fillRect(x*cellSize,y*cellSize,cellSize,cellSize);
          this.context.fillStyle=`rgba(235,65,65,${field.danger[row][column]*0.3})`;
          this.context.fillRect(x*cellSize,y*cellSize,cellSize,cellSize);
        }

        if (world.tiles[y][x] === "WALL") {
          const inset = cellSize * 0.12;
          this.context.fillStyle = TILE_COLORS.WALL;
          this.context.fillRect(
            offsetX + x * cellSize + inset,
            offsetY + y * cellSize + inset,
            cellSize - inset * 2,
            cellSize - inset * 2
          );
        }

        const chemistry = world.chemistry;
        const ash = chemistry?.ash?.[y]?.[x] ?? 0;
        const detritus = chemistry?.detritus?.[y]?.[x] ?? 0;
        const nutrients = chemistry?.nutrients?.[y]?.[x] ?? 0;
        const deathResidue = chemistry?.deathResidue?.[y]?.[x] ?? 0;
        const overflowPlume = chemistry?.overflowPlume?.[y]?.[x] ?? 0;
        const fertility = chemistry?.fertility?.[y]?.[x] ?? 1;
        if (fertility < 0.98) {
          this.context.fillStyle = `rgba(113, 76, 49, ${Math.min(0.32, (1 - fertility) * 0.32)})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
        if (nutrients > 0) {
          this.context.fillStyle = `rgba(100, 172, 200, ${Math.min(0.10, nutrients * 0.10)})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
        if (detritus > 0) {
          this.context.fillStyle = `rgba(122, 83, 50, ${Math.min(0.38, detritus * 0.38)})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
        if (ash > 0) {
          this.context.fillStyle = `rgba(180, 186, 190, ${Math.min(0.42, ash * 0.42)})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
        if (deathResidue > 0) {
          this.context.fillStyle = `rgba(112, 232, 255, ${Math.min(0.5, deathResidue / 8 * 0.5)})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
        if (overflowPlume > 0) {
          this.context.fillStyle = `rgba(94, 255, 214, ${Math.min(0.58, overflowPlume / 40 * 0.58)})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }

        const signal = world.signals?.[y]?.[x] ?? 0;
        if (signal >= 4) {
          const maximumSignal = signalSettings.maxIntensity ?? 255;
          this.context.fillStyle = `rgba(185, 107, 255, ${Math.min(0.45, (signal - 3) / Math.max(1, maximumSignal - 3) * 0.45)})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }

        // Resource marks render after environmental overlays, keeping their identity readable.
        if (world.tiles[y][x] === "FOOD") {
          const resource = world.resources?.[y]?.[x] ?? "GREEN";
          const foodAmount = world.foodAmounts?.[y]?.[x] ?? 1;
          this.context.fillStyle = RESOURCE_COLORS[resource] ?? RESOURCE_COLORS.GREEN;
          this.context.globalAlpha = 0.3 + Math.min(1, foodAmount) * 0.7;
          this.context.shadowColor = this.context.fillStyle;
          this.context.shadowBlur = 5;
          this.context.font = `bold ${Math.max(13, cellSize * 1.35)}px ui-monospace, monospace`;
          this.context.textAlign = "center";
          this.context.textBaseline = "middle";
          this.context.fillText("*", offsetX + x * cellSize + cellSize / 2, offsetY + y * cellSize + cellSize / 2 + 1);
          this.context.shadowBlur = 0;
          this.context.globalAlpha = 1;
        }
      }
    }

    // Persistent visual history only; it does not feed back into any organism decision or world rule.
    if (controls.facetTrailEnabled ?? true) {
      const facetWorkTrail = markers.facetWorkTrail ?? [];
      for (let y = 0; y < world.height; y += 1) {
        for (let x = 0; x < world.width; x += 1) {
          const visits = facetWorkTrail[y]?.[x] ?? 0;
          if (visits <= 0) continue;
          const intensity = Math.min(1, Math.log1p(visits) / Math.log(48));
          // A quiet, broad wash keeps accumulated history behind the golden living topology.
          this.context.fillStyle = `rgba(100, 190, 215, ${0.025 + intensity * 0.13})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
      }
    }

    if ((controls.environmentMemoryVisualizationEnabled ?? true) && snapshot.environmentMemory?.enabled) {
      const memory = markers.environmentMemory ?? [];
      for (let y = 0; y < world.height; y += 1) {
        for (let x = 0; x < world.width; x += 1) {
          const value = memory[y]?.[x] ?? 0;
          if (value <= 0) continue;
          const intensity = Math.min(1, Math.sqrt(value));
          this.context.fillStyle = `rgba(105, 155, 215, ${0.025 + intensity * 0.16})`;
          this.context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Diagnostic resource centers are not targets communicated to organisms.
    const patches=snapshot.bonding?.adaptiveMorphology?.resourcePatches;
    if(patches) {
      const capacity=snapshot.bonding.adaptiveMorphology.patchCapacity;
      const fieldSize=snapshot.morphologyEnvironment?.size??16;
      this.context.save();
      this.context.lineWidth=1;
      for(const patch of patches.patches) {
        const x=(patch.x+.5)/fieldSize*width,y=(patch.y+.5)/fieldSize*height;
        this.context.strokeStyle='rgba(125, 200, 220, 0.3)';
        this.context.setLineDash([3,5]);
        this.context.beginPath();this.context.arc(x,y,cellSize*1.2,0,Math.PI*2);this.context.stroke();
        this.context.setLineDash([]);
        this.context.strokeStyle='rgba(125, 215, 235, 0.6)';
        this.context.beginPath();this.context.arc(x,y,cellSize*.9,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,patch.remaining/capacity)));this.context.stroke();
      }
      this.context.restore();
    }

    for (const gate of collectiveWork.gates ?? markers.collectiveWork ?? []) {
      const centerX = offsetX + gate.x * cellSize + cellSize / 2;
      const centerY = offsetY + gate.y * cellSize + cellSize / 2;
      const isObserving = gate.phase === "observe";
      const isResponding = gate.phase === "respond";
      const isExhausted = gate.exhausted || gate.phase === "exhausted";
      const color = isExhausted ? "#6d5c72" : isResponding ? "#ffcf63" : isObserving ? "#75eaff" : "#7b8b9c";
      const alpha = isExhausted || gate.phase === "cooldown" ? 0.42 : 0.92;
      this.context.save();
      if ((gate.fieldStrength ?? 0) > 0) {
        this.context.fillStyle = `rgba(114, 255, 152, ${0.06 + gate.fieldStrength * 0.15})`;
        this.context.strokeStyle = `rgba(152, 255, 183, ${0.16 + gate.fieldStrength * 0.35})`;
        this.context.lineWidth = Math.max(1, cellSize * 0.08);
        this.context.beginPath();
        this.context.arc(centerX, centerY, cellSize * (1.25 + gate.fieldStrength * 0.65), 0, Math.PI * 2);
        this.context.fill();
        this.context.stroke();
      }
      if ((gate.fieldStrength ?? 0) > 0 && gate.outputMode === "port-coupled") {
        for (const port of gate.ports ?? []) {
          const portCenterX = offsetX + port.x * cellSize + cellSize / 2;
          const portCenterY = offsetY + port.y * cellSize + cellSize / 2;
          this.context.strokeStyle = "rgba(190, 255, 150, 0.95)";
          this.context.fillStyle = "rgba(104, 255, 137, 0.14)";
          this.context.lineWidth = Math.max(1, cellSize * 0.1);
          this.context.beginPath();
          this.context.arc(portCenterX, portCenterY, cellSize * 0.36, 0, Math.PI * 2);
          this.context.fill();
          this.context.stroke();
        }
      }
      this.context.globalAlpha = alpha;
      this.context.strokeStyle = color;
      this.context.fillStyle = "rgba(20, 51, 68, 0.7)";
      this.context.lineWidth = Math.max(1, cellSize * 0.11);
      this.context.beginPath();
      this.context.arc(centerX, centerY, cellSize * 0.58, 0, Math.PI * 2);
      this.context.fill();
      this.context.stroke();
      for (let index = 0; index < 3; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / 3;
        const portX = centerX + Math.cos(angle) * cellSize * 0.72;
        const portY = centerY + Math.sin(angle) * cellSize * 0.72;
        this.context.fillStyle = ["#7de9ff", "#d48aff", "#ffcf63"][index];
        this.context.beginPath();
        this.context.arc(portX, portY, Math.max(1.5, cellSize * 0.13), 0, Math.PI * 2);
        this.context.fill();
      }
      if (isResponding && gate.progress > 0) {
        this.context.strokeStyle = "#fff2a6";
        this.context.lineWidth = Math.max(1, cellSize * 0.12);
        this.context.beginPath();
        this.context.arc(centerX, centerY, cellSize * 0.9, -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * Math.min(1, gate.progress / (collectiveWork.requiredConsensusTicks ?? 3)));
        this.context.stroke();
      }
      this.context.fillStyle = "#f3fcff";
      this.context.font = `bold ${Math.max(8, cellSize * 0.58)}px ui-monospace, monospace`;
      this.context.textAlign = "center";
      this.context.textBaseline = "middle";
      this.context.fillText(isExhausted ? "×" : "⌘", centerX, centerY + 1);
      this.context.restore();
    }

    if (controls.gridEnabled) {
      this.context.strokeStyle = "rgba(255,255,255,0.06)";
      this.context.lineWidth = 1;

      for (let x = 0; x <= world.width; x += 1) {
        this.context.beginPath();
        this.context.moveTo(offsetX + x * cellSize, offsetY);
        this.context.lineTo(offsetX + x * cellSize, offsetY + world.height * cellSize);
        this.context.stroke();
      }

      for (let y = 0; y <= world.height; y += 1) {
        this.context.beginPath();
        this.context.moveTo(offsetX, offsetY + y * cellSize);
        this.context.lineTo(offsetX + world.width * cellSize, offsetY + y * cellSize);
        this.context.stroke();
      }
    }

    const organismsById = new Map(organisms.map((organism) => [organism.id, organism]));
    for (const facet of facets) {
      const members = facet.memberIds.map((id) => organismsById.get(id));
      if (members.length !== 3 || members.some((member) => !member)) continue;
      const xs = members.map((member) => member.x);
      const ys = members.map((member) => member.y);
      if (Math.max(...xs) - Math.min(...xs) > 2 || Math.max(...ys) - Math.min(...ys) > 2) continue;
      const capitalRatio = Math.min(1, (facet.reserve ?? 0) / (facetCapital.reserveCapacity ?? 1));
      this.context.fillStyle = `rgba(255, 244, 163, ${0.08 + capitalRatio * 0.34})`;
      this.context.beginPath();
      this.context.moveTo(offsetX + members[0].x * cellSize + cellSize / 2, offsetY + members[0].y * cellSize + cellSize / 2);
      this.context.lineTo(offsetX + members[1].x * cellSize + cellSize / 2, offsetY + members[1].y * cellSize + cellSize / 2);
      this.context.lineTo(offsetX + members[2].x * cellSize + cellSize / 2, offsetY + members[2].y * cellSize + cellSize / 2);
      this.context.closePath();
      this.context.fill();
    }
    for (const bond of bonds) {
      const first = organismsById.get(bond.firstId);
      const second = organismsById.get(bond.secondId);
      if (!first || !second) continue;
      // Wrapped neighbors are logically adjacent but a canvas-spanning line is misleading in this 2D view.
      if (Math.abs(first.x - second.x) > 2 || Math.abs(first.y - second.y) > 2) continue;
      const strength = bond.strength ?? 0.35;
      const reserveRatio = Math.min(1, (bond.reserve ?? 0) / (bondSettings.reserveCapacity ?? 1));
      this.context.strokeStyle = `rgba(255, 244, 163, ${0.12 + strength * 0.48 + reserveRatio * 0.4})`;
      this.context.lineWidth = Math.max(1, cellSize * (0.04 + strength * 0.1 + reserveRatio * 0.1));
      this.context.beginPath();
      this.context.moveTo(offsetX + first.x * cellSize + cellSize / 2, offsetY + first.y * cellSize + cellSize / 2);
      this.context.lineTo(offsetX + second.x * cellSize + cellSize / 2, offsetY + second.y * cellSize + cellSize / 2);
      this.context.stroke();
    }

    const organismsByTransferId = new Map(organisms.map((organism) => [organism.id, organism]));
    for (const transfer of markers.energyTransfers ?? []) {
      const source = organismsByTransferId.get(transfer.fromId);
      const target = organismsByTransferId.get(transfer.toId);
      if (!source || !target) continue;
      if (Math.abs(source.x - target.x) > 2 || Math.abs(source.y - target.y) > 2) continue;
      const alpha = Math.min(0.9, transfer.ttl / 6);
      this.context.strokeStyle = `rgba(127, 255, 212, ${alpha})`;
      this.context.lineWidth = Math.max(1, cellSize * 0.12);
      this.context.beginPath();
      this.context.moveTo(offsetX + source.x * cellSize + cellSize / 2, offsetY + source.y * cellSize + cellSize / 2);
      this.context.lineTo(offsetX + target.x * cellSize + cellSize / 2, offsetY + target.y * cellSize + cellSize / 2);
      this.context.stroke();
    }

    for (const fire of world.fires ?? []) {
      const centerX = offsetX + fire.x * cellSize + cellSize / 2;
      const centerY = offsetY + fire.y * cellSize + cellSize / 2;
      this.context.fillStyle = "#ff633d";
      this.context.beginPath();
      this.context.moveTo(centerX, centerY - cellSize * 0.36);
      this.context.lineTo(centerX - cellSize * 0.32, centerY + cellSize * 0.27);
      this.context.lineTo(centerX + cellSize * 0.32, centerY + cellSize * 0.27);
      this.context.closePath();
      this.context.fill();
    }

    for (const organism of organisms) {
      const centerX = offsetX + organism.x * cellSize + cellSize / 2;
      const centerY = offsetY + organism.y * cellSize + cellSize / 2;
      const radius = Math.max(2.5, cellSize * 0.24);
      const form = phenotype(organism);

      if (form.hasSignal && organism.signalOutput > (signalSettings.activationThreshold ?? 0)) {
        this.context.strokeStyle = `rgba(185, 107, 255, ${Math.min(0.75, 0.18 + organism.signalOutput / 8 * 0.57)})`;
        this.context.lineWidth = Math.max(1, cellSize * 0.08);
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius + Math.max(2, cellSize * 0.2), 0, Math.PI * 2);
        this.context.stroke();
      }

      const courierType = organism.courierReport?.type ?? organism.courierMemory?.type;
      if (courierType) {
        this.context.strokeStyle = COURIER_COLORS[courierType] ?? "#ffffff";
        this.context.lineWidth = Math.max(1, cellSize * 0.09);
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius + Math.max(3, cellSize * 0.3), 0, Math.PI * 2);
        this.context.stroke();
      }

      if (organism.collectiveStrideActive) {
        this.context.strokeStyle = organism.satietyMigrationActive ? "rgba(114, 255, 184, 0.95)" : "rgba(77, 224, 255, 0.9)";
        this.context.lineWidth = Math.max(1, cellSize * 0.08);
        this.context.setLineDash([Math.max(1, cellSize * 0.12), Math.max(1, cellSize * 0.1)]);
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius + Math.max(3, cellSize * 0.32), 0, Math.PI * 2);
        this.context.stroke();
        this.context.setLineDash([]);
      }

      if (organism.collectiveTransportActive) {
        this.context.strokeStyle = "rgba(255, 183, 77, 0.98)";
        this.context.lineWidth = Math.max(1, cellSize * 0.1);
        this.context.setLineDash([Math.max(1, cellSize * 0.18), Math.max(1, cellSize * 0.08)]);
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius + Math.max(5, cellSize * 0.43), 0, Math.PI * 2);
        this.context.stroke();
        this.context.setLineDash([]);
      }

      if (snapshot.guidedStructuralIntelligence?.enabled && (organism.guidedResponseTrace ?? 0) > 0.01) {
        const trace = Math.min(1, organism.guidedResponseTrace);
        this.context.strokeStyle = `rgba(117, 234, 255, ${0.2 + trace * 0.75})`;
        this.context.lineWidth = Math.max(1, cellSize * 0.08);
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius + Math.max(2, cellSize * (0.16 + trace * 0.4)), 0, Math.PI * 2);
        this.context.stroke();
      }

      if (organism.energy >= 90) {
        this.context.strokeStyle = "rgba(255, 244, 163, 0.9)";
        this.context.lineWidth = Math.max(1, cellSize * 0.08);
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius + Math.max(1, cellSize * 0.14), 0, Math.PI * 2);
        this.context.stroke();
      }

      this.context.fillStyle = form.color;
      this.context.beginPath();
      this.context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.context.fill();

      if (form.hasPersistence) {
        this.context.strokeStyle = "rgba(235, 255, 248, 0.82)";
        this.context.lineWidth = Math.max(1, cellSize * 0.07);
        this.context.beginPath();
        this.context.arc(centerX, centerY, Math.max(1.5, radius * 0.48), 0, Math.PI * 2);
        this.context.stroke();
      }

      if (form.hasSpatialAwareness) {
        this.context.strokeStyle = "rgba(125, 255, 114, 0.9)";
        this.context.lineWidth = 1;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          this.context.beginPath();
          this.context.moveTo(centerX + dx * (radius + 1), centerY + dy * (radius + 1));
          this.context.lineTo(centerX + dx * (radius + 3), centerY + dy * (radius + 3));
          this.context.stroke();
        }
      }

      for (let ring = 0; ring < form.amplified; ring += 1) {
        this.context.strokeStyle = "rgba(255, 244, 163, 0.72)";
        this.context.lineWidth = 1;
        this.context.beginPath();
        this.context.arc(centerX, centerY, radius + 3 + ring * 2, 0, Math.PI * 2);
        this.context.stroke();
      }

    }

    for (const marker of markers.births) {
      const centerX = offsetX + marker.x * cellSize + cellSize / 2;
      const centerY = offsetY + marker.y * cellSize + cellSize / 2;
      const alpha = marker.ttl / 10;
      this.context.strokeStyle = `rgba(255, 244, 163, ${alpha})`;
      this.context.lineWidth = Math.max(1, cellSize * 0.08);
      this.context.beginPath();
      this.context.arc(centerX, centerY, Math.max(4, cellSize * 0.48), 0, Math.PI * 2);
      this.context.stroke();
    }

    for (const marker of markers.primaryProduction ?? []) {
      const centerX = offsetX + marker.x * cellSize + cellSize / 2;
      const centerY = offsetY + marker.y * cellSize + cellSize / 2;
      const alpha = Math.min(0.9, marker.ttl / 4);
      this.context.strokeStyle = `rgba(220, 255, 129, ${alpha})`;
      this.context.lineWidth = Math.max(1, cellSize * 0.09);
      this.context.beginPath();
      this.context.arc(centerX, centerY, Math.max(3, cellSize * (0.25 + (4 - marker.ttl) * 0.08)), 0, Math.PI * 2);
      this.context.stroke();
    }

    for (const marker of markers.deaths) {
      const centerX = offsetX + marker.x * cellSize + cellSize / 2;
      const centerY = offsetY + marker.y * cellSize + cellSize / 2;
      const alpha = marker.ttl / 14;
      const size = Math.max(3, cellSize * 0.26);
      this.context.strokeStyle = `rgba(255, 124, 115, ${alpha})`;
      this.context.lineWidth = Math.max(1, cellSize * 0.09);
      this.context.beginPath();
      this.context.moveTo(centerX - size, centerY - size);
      this.context.lineTo(centerX + size, centerY + size);
      this.context.moveTo(centerX + size, centerY - size);
      this.context.lineTo(centerX - size, centerY + size);
      this.context.stroke();
    }
  }

  findOrganismAt(clientX, clientY) {
    if (!this.lastSnapshot) {
      return null;
    }

    const { world, organisms } = this.lastSnapshot;
    const bounds = this.canvas.getBoundingClientRect();
    const cellSize = CELL_SIZE;
    const offsetX = 0;
    const offsetY = 0;
    const x = Math.floor((clientX - bounds.left - offsetX) / cellSize);
    const y = Math.floor((clientY - bounds.top - offsetY) / cellSize);

    return organisms.find((organism) => organism.x === x && organism.y === y) ?? null;
  }
}
