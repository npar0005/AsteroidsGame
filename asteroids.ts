// FIT2102 2019 Assignment 1
// https://docs.google.com/document/d/1Gr-M6LTU-tfm4yabqZWJYg-zTjEVqHKKTCvePGCYsUA/edit?usp=sharing


/*
 Overall design: For this program, I had to manage the game states of all the 
 SVG and graphical components to do this, I used classes to keep track of the states
 of the different graphical components such as the bullets, ship, asteroids etc.

 My design decisions tried to focus on making my functions pure. To aid with this, I used 
 methods such as .filter, .map, and .reduce on my arrays. Moreover, I tried to follow FRP
 by minimizing the side-effects caused by my functions.

 For the event-handling, I also used the Observable class. Using the Observable class allowed
 me to treat my event-streams as arrays and use methods such as .map, .filter, .flatMap and 
 .subscribe(). These methods allowed me to use the fluent functional design provided by the
 Observable class. Moreover, I implemented lazy-evaluation by keeping an actions map within 
 my program.

 By using lazy-evaluation for my action functions, I was able to call the particular action
 methods when I needed them to be called within the main game loop. Lastly, to focus on the 
 FRP style of programming, I also tried to implement helper functions such as "dir", 
 "radians" and "rand" to create reusable modules within my code. I even tried to implement this 
 idea into my objects such as by using the "update()" method which can be called many times
 to reposition the SVG element.
*/


const DEBUG = false;

let score = 0;
class Canvas {
  svg: HTMLElement;
  width: number;
  height: number;

  constructor(svg: HTMLElement) {
    this.width = svg.getBoundingClientRect().width;
    this.height = svg.getBoundingClientRect().height;
    this.svg = svg;
  }

  inBounds(x:number, y:number, r:number): boolean;
  inBounds(x:number, y:number, r:number, h?:number): boolean {
    if(typeof h === "undefined") {
      return 0 <= x+r && x-r <= this.width && 0 <= y+r && y-r <= this.height;
    }
    const w = r;
    return 0 <= x+w/2 && x-w/2 <= this.width && 0 <= y+h/2 && y-h/2 <= this.height; 
  }
}

class Asteroid {
  canvas: Canvas;
  r: number;
  
  x: number;
  y: number;
  dx: number;
  dy: number;
  targetX: number;
  targetY: number;
  t: number;
  body: Elem;
  speed: number;
  points: number[][];
  alive: boolean;
  laserAsteroid: boolean;
  strongAsteroid: boolean;

  color: string;
  sound: HTMLAudioElement;
  scoreElem: HTMLElement;
  ship: Ship;

  constructor(svg: HTMLElement, canvas: Canvas, scoreElem: HTMLElement, sounds: HTMLAudioElement[], ship: Ship) {
    this.r = rand(75, 125);
    this.canvas = canvas;
    
    this.scoreElem = scoreElem;
    // Pick where to spawn asteroid, top or bottom and left or right of canvas
    const pos = [];
    pos.push([-this.r, rand(-this.r/2, canvas.height)]);
    pos.push([canvas.width, rand(-this.r/2, canvas.height)]);
    pos.push([rand(-this.r, canvas.width), -this.r/2]);
    pos.push([rand(-this.r, canvas.width), canvas.height+this.r/2]);

    // Calculate the x & y position for the spawn of the asteroid
    const [x, y] = pos[~~(Math.random() * pos.length)];
    this.x = x;
    this.y = y;

    // Pick a random location on the screen for the asteroid to head towards
    this.targetX = ship.x;
    this.targetY = ship.y;

    // Calculate vector towards the target ("homing asteroids")
    this.dx = this.targetX - this.x;
    this.dy = this.targetY - this.y;

    // Perform normalization of the vector so asteroids move at consistent speeds (v = v/|v|)
    const mag = dist(this.x, this.targetX, this.y, this.targetX);
    this.dx /= mag;
    this.dy /= mag;

    this.t = 1+Math.random() * 2;


    // Decide whether the asteroid should be a laser asteroid
    this.laserAsteroid = rand(1, 10) == 1; // 1/10 chance of being a laser asteroid
    
    // Decide whether the asteroid should be a "strong" asteroid
    this.strongAsteroid = rand(1, 10) == 1; // 1/10 chance of being a strong asteroid
    this.laserAsteroid = this.laserAsteroid && !this.strongAsteroid; // Set laserAsteroid to false if strongAsteroid is true, otherwise, keep value of laserAsteroid

    if(this.laserAsteroid)
      this.color = 'red';
    else if(this.strongAsteroid)
      this.color = 'burlywood';
    else
      this.color = 'grey';

    // Pick a random sound for the asteroid when it dies
    this.sound = sounds[~~(Math.random() * sounds.length)]; 
    this.sound.volume = 0.3; // Set the volume

    if(DEBUG) { // If debug mode is turned on, then display the vector the asteroids follow
      new Elem(svg, "line")
        .attr("x1", this.x).attr("y1", this.y).attr("x2", this.targetX).attr("y2", this.targetY).attr("stroke", "orange");
      
      new Elem(svg, "circle").attr("cx", this.targetX).attr("cy", this.targetY).attr("r", 7).attr("fill", "purple");
    }
    this.alive = true;
    this.speed = Math.random()/2; // Set a random speed
    
    this.ship = ship;

    // Create a generic polygon 
    this.points = [
      [0, 0],
      [this.r/4, this.r/2],
      [(3*this.r)/4, this.r/2],
      [this.r, 0],
      [(3*this.r)/4, -this.r/2],
      [this.r/4, -this.r/2],
      [0, 0]
    ];
    
    // Morph the generic polygon by moving each point by a factor of the polygons height and width
    //this.points = this.points.map(([x, y]) => [this.getXOffset(x), this.getYOffset(y)]);
    //this.points.push(this.points[0]); // close the polygon correctly

    const points_str = this.points.reduce((acc, [x, y]) => `${acc}${x},${y} `, ``).trim();
    this.body = new Elem(svg, 'polygon')
      .attr("transform",`translate(${this.x} ${this.y})`)  
      .attr("points", points_str)
      .attr("style",`fill:${this.color};stroke:white;stroke-width:1;opacity:0.7`);
  }

  move() {
    this.x += this.dx*this.t;
    this.y += this.dy*this.t;

    this.body.attr("transform",`translate(${this.x} ${this.y})`);
    this.killAsteroid();
  }

  killAsteroid() {
    if(this.alive && this.x+this.r < 0 || this.x > this.canvas.width || this.y+this.r/2 < 0 || this.y-this.r/2 > this.canvas.height) {
      this.alive = false;
      this.body.elem.remove();
    }
  }

  // Checks if the asteroid collides when any of the bullets in the array
  checkCollisions(bullets: Bullet[]) {
    const r = this.r/2;
    const cx = this.x + r
    const cy = this.y;
    
    bullets.forEach(bullet => {
      // Get the distance between the centers of both the bullet and the asteroid
      const d = dist(cx, bullet.cx, cy, bullet.cy);

      // If the distance is smaller than the raduis of the asteroid and the bullet's radius, then the two must be intersecting
      if(d < r + bullet.r) { // collision between bullet and this asteroid
        bullet.alive = false; // kill the bullet
        this.alive = this.strongAsteroid; // kill the asteroid (set to false, if this.strongAsteroid is false)
        if(!this.alive) {
          this.body.elem.remove(); // remove the asteroid from the screen
          score++; // Increment score
          this.scoreElem.innerText = score.toString();
          if(this.laserAsteroid) {
            this.ship.laserMode = true;
  
            // Execute the observable stream 
            Observable.interval(1000)
              .filter(_ => this.ship.laserMode) // Keep the interval streams only when the laserMode is turned on
              .flatMap(_ => Observable.interval(500).filter(_ => this.ship.laserMode)) // Flat map each interval stream to a new interval, which gets filtered to only be activated when laserMode is turned on
              .subscribe(_ => { // Execute and turn the laserMode off
                this.ship.laserMode = false;
              });
          }
          
          // Set the sound to the beginning (ie: stop the sound)
          this.sound.pause();
          this.sound.currentTime = 0;
  
          // Play the sound again
          this.sound.play();
        }
      }
    });
    return this.alive;
  }

  // Check if the ship intersects with the current asteroid
  intersectsShip(ship: Ship, sound: HTMLAudioElement) {
    const r = this.r/2;
    const cx = this.x + r
    const cy = this.y;

    // Treat ship as circle and detect collisions between the asteroid and the ship
    const shipR = ship.height/2;
    const d = dist(cx, ship.x, cy, ship.y);
    
    if(d < shipR + r) {
      ship.ship.elem.remove();
      ship.alive = false;
      sound.play();
    }
  }
}

class Bullet {
  elem: Elem;
  cx: number;
  cy: number;
  r: number;
  dir: number;
  alive: boolean;

  constructor(svg: HTMLElement, cx: number, cy: number, r: number, dir: number) {
    this.cx = cx;
    this.cy = cy;
    this.r = r;
    this.dir = dir;
    this.elem = new Elem(svg, "circle")
                  .attr("cx", this.cx)
                  .attr("cy", this.cy)
                  .attr("r", this.r)
                  .attr("fill", "red");
    this.alive = true;
  }

  move(speed: number) {
    const rot_rad = radians(this.dir); // get the radians version of the rotation
    const dx = Math.sin(rot_rad); // get the dx in terms of sin (North is considered 0 deg we need to use sin)
    const dy = -Math.cos(rot_rad); // get the dy in tterms of cos (North is considrerd 0 def, we need to use -cos)

    this.cx += dx*speed; 
    this.cy += dy*speed;

    this.update(); // redraw the bullet
  }

  update() {
    this.elem.attr("cx", this.cx).attr("cy", this.cy);
  }
}

class Ship {
  ship: Elem;
  alive: boolean;
  x: number;
  y: number;
  height: number;
  width: number;


  rot: number;
  velocity: number;
  acceleration: number;
  force: number;
  bullets: Bullet[] = [];

  dirX: number;
  dirY: number;
  dx: number;
  dy: number;
  thrusting: boolean;
  shooting: boolean;
  laserMode: boolean;

  constructor(g: Elem, x: number, y: number, rot: number) {
    this.ship = g; 
    this.alive = true;
    this.x = x;
    this.y = y;
    this.rot = rot;
    this.velocity = 0;
    this.acceleration = 0.1;
    this.force = 0;
    
    // Get the height and width of the ship from the svg element
    const {height, width} = this.ship.elem.getBoundingClientRect();
    this.height = height;
    this.width = width;
    this.bullets = []; // set the bullets assosiated with the bullet

    this.thrusting = false;
    this.dirX = 0;
    this.dirY = 0;
    this.dx = 0;
    this.dy = 0;
    this.shooting = false;

    this.laserMode = false;
  }

  rotate(dir: number) { // rotate the ship in a particular direction and speed (- = left, + = right, high number = fast rotation)
    this.rot += dir;
    this.update(); // redraw the ship after rotation
  }

  shoot(svg: HTMLElement, sound: HTMLAudioElement) {
    const r = 5;
    if(!this.shooting) { // If the player is not shooting, then spawn a new bullet
      this.bullets.push(new Bullet(svg, this.x, this.y, r, this.rot)); // spawn a new bullett and add it to the bullets array to keep track of
      
      // Restart the shoot sound
      sound.pause();
      sound.currentTime = 0;
      sound.play();
    }
    // Set shooting to true or false, false = multishot
    this.shooting = !this.laserMode; // set to true when one space = one bullet
  }

  thrust() {
    // Move the ship in the direction of dirX and dirY
    this.x += this.dirX;
    this.y += this.dirY;

    this.update(); // redraw the ship
  }

  applyForce(mult: number, sound: HTMLAudioElement) { // invoked when "w" (thrust) occurs

    if(sound.paused) { // if the sound is not playing, play it (don't play it if it is already playing)
      sound.volume = 0.2;
      sound.play();
    }

    this.thrusting = true;  
    const max_speed = 18; // set the cap for the force
    this.velocity += this.acceleration; // increase the velocity by a constant amount each game loop
    if(this.velocity > max_speed) // if the velocity exceeds a certain magnitude, we can limit it to the max_speed cap
      this.velocity = max_speed;

    this.force = this.velocity*mult; //set the force to be equal to the velocity multiplied by some scalar constant `mult`
    
    this.setDirection();
  }

  reduceForce(mult: number, sound: HTMLAudioElement) { // invoked when "w" is no longer being held
    if(!sound.paused) { // stop the audio from playing
      sound.pause();
      sound.currentTime = 0;
    }
  
    this.thrusting = false;
    this.velocity -= this.acceleration/2; // reduce the velocity by a 4th of the acceleration
    if(this.velocity < 0) // if the velocity is less than 0, set it equal to 0
      this.velocity = 0;
    this.force = this.velocity*mult; // set the force to be equal to the velicty multiplied by some scalar constant `mult`, for smooth transitions, mult should be the same for both apply and reduce force
    
    // Set the directon of the ship based on the dy and xy, and multiply it by the force (to speed it up)
    this.dirX = this.dx*this.force;
    this.dirY = this.dy*this.force;
  }

  setDirection() {
    const rot_rad = radians(this.rot); // get the radians version of the rot
    // Calculate direction
    this.dx = Math.sin(rot_rad); // get the dx in terms of sin (North is considered 0 deg we need to use sin)
    this.dy = -Math.cos(rot_rad);

    this.dirX = this.dx*this.force;
    this.dirY = this.dy*this.force;
  }

  update() { // updates the ship's position
    this.ship.attr("transform", `translate(${this.x} ${this.y}) rotate(${(this.rot) % 360})`);
  }

  // Manages the "torus" geo of the 2d canvas
  wrap(canv: Canvas) {
    if(this.x+this.width/2 < 0) { // check if entire ship is out of the top of canvas
      this.x = canv.width+this.width/2;
    }

    if(this.y+this.height/2 < 0) { // check if entire ship is out of the left of canvas
      this.y = canv.height+this.height/2;
    }

    if(this.y-this.height/2 > canv.height) { // check if entire ship is out of the bottom of canvas
      this.y = -this.height/2;
    }

    if(this.x-this.width/2 > canv.width) { // check if entire ship is out of the right of canvas
      this.x = -this.width/2;
    }
  }
}

// A function to convert degrees to radians for Math.cos and Math.sin
const radians = (theta: number) => theta*(Math.PI/ 180);
// Calculates a random number between the min and max 
const rand = (min: number, max: number) => ~~(Math.random() * (max - min + 1)) + min;
// Calculates the distance 
const dist = (x1: number, x2: number, y1: number, y2: number) => ((x2-x1)**2 +(y2 -y1)**2)**0.5;

function asteroids() {
  // Inside this function you will use the classes and functions 
  // defined in svgelement.ts and observable.ts
  // to add visuals to the svg element in asteroids.html, animate them, and make them interactive.
  // Study and complete the Observable tasks in the week 4 tutorial worksheet first to get ideas.

  // You will be marked on your functional programming style
  // as well as the functionality that you implement.
  // Document your code!  
  // Explain which ideas you have used ideas from the lectures to 
  // create reusable, generic functions.
  
  // make a group for the spaceship and a transform to move it and rotate it
  // to animate the spaceship you will update the transform property
  const svg = document.getElementById("canvas")!;

  const options = { // create default game options
    start_x: 300,
    start_y: 300,
    start_theta: 0,
    rot_speed: 4,
    force_mult: 0.25,
    pew_audio: "audio/pew.wav",
    thrust_audio: "audio/thrust.wav",
    asteroid_kill: "audio/asteroid_kill.wav",
    asteroid_kill2: "audio/asteroid_kill2.wav",
    game_over: "audio/game_over.wav"
  }
  // Create a canvas, and use the svg element used for the canvas
  const canvas = new Canvas(svg);
  // Destructure the options
  const {start_x: x, start_y: y, start_theta: theta, rot_speed, force_mult} = options; // get the game options to be used within the game
  let g = new Elem(svg,'g')
    .attr("transform",`translate(${x} ${y}) rotate(${theta})`)  
  
  // create a polygon shape for the space ship as a child of the transform group
  new Elem(svg, 'polygon', g.elem) 
    .attr("points","-15,20 15,20 0,-20")
    .attr("style","fill:lime;stroke:purple;stroke-width:1");

  // Set the default score value onto the DOM
  const scoreElem = document.getElementById("score")!;
  scoreElem.innerText = score.toString();  
  
  // Create the observables to listen for keydown and keyup events 
  const keydown = Observable.fromEvent<KeyboardEvent>(document, 'keydown');
  const keyup = Observable.fromEvent<KeyboardEvent>(document, 'keyup');
  

  interface ActionsMap {
    [key: string]: (x:Ship) => void;
  }

  // Get references to the sounds needed to be played
  const pewSound = new Audio(options.pew_audio); // Sound from: https://freesound.org/people/MATTIX/sounds/413057/
  const thrustSound = new Audio(options.thrust_audio); // Sound from: https://freesound.org/people/gg3137/sounds/432436/
  const asteroidSounds = [new Audio(options.asteroid_kill), new Audio(options.asteroid_kill2)]; // Sounds from: https://freesound.org/people/thehorriblejoke/sounds/259962/ and https://freesound.org/people/stumpbutt/sounds/381686/
  const gameOverSound = new Audio(options.game_over); // Sound from: https://freesound.org/people/cabled_mess/sounds/350980/

  // Map each key to a particular function which will lazly execute a function when needed
  const actions: ActionsMap = {
    "a": (ship: Ship) => ship.rotate(-rot_speed),
    "d": (ship: Ship) => ship.rotate(rot_speed),
    "w": (ship: Ship) => ship.applyForce(force_mult, thrustSound),
    "s": (ship: Ship) => ship.reduceForce(force_mult, thrustSound),
    " ": (ship: Ship) => ship.shoot(svg, pewSound)
  }


  // By keeping a map of currently pressed keys, we can use a game loop to execute each key's action such that we can perform multiple actions at once
  const enabled_keys_set = new Set<string>();

  // Create a ship object
  const ship = new Ship(g, x, y, theta); // create new Ship instance from g, x, y, and angle theta

  // Map each keydown stream to a lowercase key, and then filter all those which are only in actions
  keydown
    .map(({key}) => key.toLowerCase())
    .filter(key => key in actions) // only enable the key if the key is a valid game key (this helps with performance in the game loop)
    .subscribe((key) => enabled_keys_set.add(key)); // add the key the the enabled keys set
  
  keyup
    .map(({key}) => key.toLowerCase())
    .filter(key => enabled_keys_set.has(key)) // only disable the key if the key is a valid game key
    .subscribe((key) => enabled_keys_set.delete(key));


  // Holds all the asteroids in the game currently
  let asteroid_container: Asteroid[] = [];  

  // Game Loop:
  const FPS = 90;
  const gameState = {ship, enabled_keys_set, asteroid_container, gameOver: false}; // Models the state of the game currently
  // Creates a main game loop which executes at 60 FPS 
  const mainTimer = Observable.interval(1000/FPS).map(_ => gameState); // Map each interval stream to an object of the gameState
  
  // Filter out all the keys which are not the up arrow
  mainTimer
    .filter(({enabled_keys_set}) => !enabled_keys_set.has('w'))
    .subscribe(({ship}) => ship.reduceForce(force_mult, thrustSound)); // If the up arrow is not being pressed, we can reduce the thrust force

  // Filter out all the keys which are not a space " "
  mainTimer
    .filter(({enabled_keys_set}) => !enabled_keys_set.has(' '))
    .subscribe(({ship}) => {
      ship.shooting = false; // Set the ships shooting status to false, as space is not being pressed
    });


  // Create a loop which executes every second
  Observable.interval(1000)
    .map(_ => gameState) // map each interval to a gameState object
    .filter(({gameOver}) => !gameOver) // only spawn asteroids while the game is not over
    .map(_ => asteroid_container) // map each state to an asteroid container
    .subscribe(container => {
       container.push(new Asteroid(svg, canvas, scoreElem, asteroidSounds, ship)); // push a new asteroid to the asteroid container
    });

  // End game state
  mainTimer
  .filter(({ship: {alive}, gameOver}) => !alive && !gameOver) // Only keep the interval streams while the game is not over and the ship is alive
  .subscribe((gameState) => {
    thrustSound.pause(); // Stop the thrust sound when the game is over
    gameState.gameOver = true; // Set the game over state to ture
    alert("You died! Total Score: " +score); // Show end game 
  });

 
  // Main game loop - only keep the intervals when the game is not over
  mainTimer.filter(({gameOver}) => !gameOver).subscribe(({enabled_keys_set, ship}) => { 
    ship.thrust(); // constantly try and move the ship foward
    ship.wrap(canvas); // apply boundary code to wrap the ship
      
    // Loop through enabled key, and get their associated actions to perform
    enabled_keys_set.forEach((key:string) => {
      const action = actions[key]; // get action
      action && action(ship); // using short-circuiting we can check if action is not undefined and then execute the action function
    });

    // Move any bullets currently present on the screen
    ship.bullets.forEach(bullet => {
      bullet.move(5); // move each bullet with a speed of 5
    });

    // Move each asteroid and check whether it intersects with a bullet
    asteroid_container.forEach(asteroid => { 
      const collides = asteroid.checkCollisions(ship.bullets); // check if the asteroid is colliding with anmy of the bullets
      asteroid.intersectsShip(ship, gameOverSound); // check if the the ship collides with the asteroid
      asteroid.move(); // Move the asteroid
    });
   

    // Filter out all the asteroids which are alive, all those which are no longer alive will not be the resulting array
    asteroid_container = asteroid_container.filter(({alive}: {alive: boolean}) => alive);

    // Set bullets array to only the current alive status of each bullet 
    const bullets = ship.bullets = ship.bullets.map(bullet => {
      bullet.alive = bullet.alive && canvas.inBounds(bullet.cx, bullet.cy, bullet.r);
      return bullet;
    });

    // Get all the bullets which are alive, and then remove the element from the DOM
    ship.bullets.filter(({alive}) => !alive).forEach(({elem}) => {
      elem.elem.remove();
    });
    // Update the ship's bullets to only include those which are "alive"
    ship.bullets = bullets.filter(({alive}) => alive);
  });
}

// the following simply runs your asteroids function on window load.  Make sure to leave it in place.
if (typeof window != 'undefined')
  window.onload = ()=>{
    asteroids();
  }