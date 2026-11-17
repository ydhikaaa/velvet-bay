// Staged screenshot scenes for Velvet Bay: ?shot=cover|street|mission|start
// drops the game into a composed, fully-playing state so the screenshots are
// real renders of the game, not menus. No assets are faked or composited.

export function applyShotMode(ctx) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  const { state, player, vehicles, police, missions, audio } = ctx;
  state.shotMode = shot;

  if (shot === 'start') {
    // Leave the start screen up; the game world idles behind it.
    return shot;
  }
  // Staged scenes snap the camera on the first frame so the shot is framed.
  state.snapCamera = true;

  if (shot === 'cover') {
    // Sunset car chase: player driving downtown, wanted 3, police ahead and
    // behind in frame, mission 2 active with its objective on the HUD.
    state.timeOfDay = 17.6;
    state.wantedHeat = 48;
    state.wanted = 3;
    state.money = 2450;
    state.health = 82;
    state.ammo = 48;
    const car = vehicles.find((v) => v.parked) || vehicles[0];
    car.parked = false;
    car.traffic = false;
    state.inCar = car;
    car.x = -40; car.z = 60;
    car.heading = Math.PI;
    car.speed = 24;
    state.playerPos.x = car.x;
    state.playerPos.z = car.z;
    state.playerHeading = car.heading;
    missions.start(state, 1, audio);
    police.cars = [];
    // Police cruisers ahead of the player, in the camera's view down the road.
    const spots = [[-58, 36], [-24, 28], [-44, 14]];
    for (const [px, pz] of spots) {
      const pc = police.spawnCarAt(px, pz);
      pc.heading = Math.PI;
      police.cars.push(pc);
    }
  } else if (shot === 'street') {
    // Midday on foot downtown, traffic and pedestrians all around.
    // Stand on the sidewalk looking north-east toward the towers.
    state.timeOfDay = 12.5;
    state.money = 1250;
    state.health = 100;
    state.playerPos.x = 10;
    state.playerPos.z = 34;
    state.playerHeading = 0.3;
    state.cameraYaw = 0.3;
    missions.start(state, 0, audio);
  } else if (shot === 'mission') {
    // Dusk at the dockyard: mission 3 combat, enemies out, wanted 2.
    // The player stands on open sand south of the yard, cranes and gang in view.
    state.timeOfDay = 20.5;
    state.wantedHeat = 30;
    state.wanted = 2;
    state.money = 3650;
    state.health = 68;
    state.ammo = 42;
    state.playerPos.x = -248;
    state.playerPos.z = 250;
    state.playerHeading = Math.PI;
    state.cameraYaw = 0;
    missions.start(state, 2, audio);
    // Jump straight to the combat stage with enemies on the ground.
    const a = missions.active;
    if (a) {
      a.stage = 1;
      a.enemies = missions.spawnStageEnemies(state);
      missions.setMarkerForStage(state);
    }
  }
  return shot;
}
