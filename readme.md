# [d20.zip](https://d20.zip)

Simple in-browser 3D dice roller.

# Issues

These are the issues with the current version, but I'm not planning on fixing them. They seem minor enough to not cause
significant issues.

- D2s should really be coins, but the phsyics engine struggles hard with thin flat objects, so I use D4s instead.
- Dice sometimes land cocked, and a value is chosen based on what is most upright. In reality a cocked dice needs to be
  re-thrown, but I don't think this system should be responsible for that.

# License & Attribution

Code licensed under [MIT](license.txt) (vibecoded via [JetBrains Junie](https://www.jetbrains.com/junie/)).

<sub>I'm pretty staunchly anti-vibecoding, but I decided to try it on something small and fun, so I would at least have
experience with it.</sub>

Libraries:

- [three.js](https://threejs.org/) (3D engine)
- [Rapier](https://rapier.rs/) (physics engine)
- [stats.js](https://mrdoob.github.io/stats.js/) (performance monitor)

Icons:

- [Favicon created by Freepik - Flaticon](https://www.flaticon.com/free-icons/icosahedron)
- [GitHub logo by GitHub](https://primer.style/octicons/)

Audio samples:

- [Dice roll audio by ElevenLabs](https://elevenlabs.io/sound-effects/dice-roll)
