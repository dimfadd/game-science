/* Template: copy this folder to games/<id>/ and replace the level logic. */
(function () {
  'use strict';
  const GAME = 'template';
  const LEVELS = [/* level definitions */ {}, {}, {}];

  const svg = document.getElementById('stage');
  const hud = GS.hud({ gameId: GAME, title: 'Nama Game', levelCount: LEVELS.length, onLevelPick: i => run.go(i) });
  const run = GS.runner({ gameId: GAME, count: LEVELS.length, hud, start: buildLevel });

  // Static background drawn once.
  const bg = GS.el('g', { class: 'bg' }, svg);
  GS.markup(bg, GS.art.scene('kampung', 1280, 800));
  const world = GS.el('g', { class: 'world' }, svg);

  let tries = 0;
  function buildLevel(i) {
    world.innerHTML = '';
    tries = 0;
    const L = LEVELS[i];
    // ... build the level from L
    GS.say('Petunjuk singkat untuk level ini.');
  }

  function finish() {
    const stars = tries === 0 ? 3 : tries <= 2 ? 2 : 1;
    run.win(stars, 'Hebat!');
  }

  run.go(GS.store.nextLevel(GAME, LEVELS.length));
})();
