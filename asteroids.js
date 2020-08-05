"use strict";
const DEBUG = false;
let score = 0;
class Canvas {
    constructor(svg) {
        this.width = svg.getBoundingClientRect().width;
        this.height = svg.getBoundingClientRect().height;
        this.svg = svg;
    }
    inBounds(x, y, r, h) {
        if (typeof h === "undefined") {
            return 0 <= x + r && x - r <= this.width && 0 <= y + r && y - r <= this.height;
        }
        const w = r;
        return 0 <= x + w / 2 && x - w / 2 <= this.width && 0 <= y + h / 2 && y - h / 2 <= this.height;
    }
}
class Asteroid {
    constructor(svg, canvas, scoreElem, sounds, ship) {
        this.r = rand(75, 125);
        this.canvas = canvas;
        this.scoreElem = scoreElem;
        const pos = [];
        pos.push([-this.r, rand(-this.r / 2, canvas.height)]);
        pos.push([canvas.width, rand(-this.r / 2, canvas.height)]);
        pos.push([rand(-this.r, canvas.width), -this.r / 2]);
        pos.push([rand(-this.r, canvas.width), canvas.height + this.r / 2]);
        const [x, y] = pos[~~(Math.random() * pos.length)];
        this.x = x;
        this.y = y;
        this.targetX = ship.x;
        this.targetY = ship.y;
        this.dx = this.targetX - this.x;
        this.dy = this.targetY - this.y;
        const mag = dist(this.x, this.targetX, this.y, this.targetX);
        this.dx /= mag;
        this.dy /= mag;
        this.t = 1 + Math.random() * 2;
        this.laserAsteroid = rand(1, 10) == 1;
        this.strongAsteroid = rand(1, 10) == 1;
        this.laserAsteroid = this.laserAsteroid && !this.strongAsteroid;
        if (this.laserAsteroid)
            this.color = 'red';
        else if (this.strongAsteroid)
            this.color = 'burlywood';
        else
            this.color = 'grey';
        this.sound = sounds[~~(Math.random() * sounds.length)];
        this.sound.volume = 0.3;
        if (DEBUG) {
            new Elem(svg, "line")
                .attr("x1", this.x).attr("y1", this.y).attr("x2", this.targetX).attr("y2", this.targetY).attr("stroke", "orange");
            new Elem(svg, "circle").attr("cx", this.targetX).attr("cy", this.targetY).attr("r", 7).attr("fill", "purple");
        }
        this.alive = true;
        this.speed = Math.random() / 2;
        this.ship = ship;
        this.points = [
            [0, 0],
            [this.r / 4, this.r / 2],
            [(3 * this.r) / 4, this.r / 2],
            [this.r, 0],
            [(3 * this.r) / 4, -this.r / 2],
            [this.r / 4, -this.r / 2],
            [0, 0]
        ];
        const points_str = this.points.reduce((acc, [x, y]) => `${acc}${x},${y} `, ``).trim();
        this.body = new Elem(svg, 'polygon')
            .attr("transform", `translate(${this.x} ${this.y})`)
            .attr("points", points_str)
            .attr("style", `fill:${this.color};stroke:white;stroke-width:1;opacity:0.7`);
    }
    move() {
        this.x += this.dx * this.t;
        this.y += this.dy * this.t;
        this.body.attr("transform", `translate(${this.x} ${this.y})`);
        this.killAsteroid();
    }
    killAsteroid() {
        if (this.alive && this.x + this.r < 0 || this.x > this.canvas.width || this.y + this.r / 2 < 0 || this.y - this.r / 2 > this.canvas.height) {
            this.alive = false;
            this.body.elem.remove();
        }
    }
    checkCollisions(bullets) {
        const r = this.r / 2;
        const cx = this.x + r;
        const cy = this.y;
        bullets.forEach(bullet => {
            const d = dist(cx, bullet.cx, cy, bullet.cy);
            if (d < r + bullet.r) {
                bullet.alive = false;
                this.alive = this.strongAsteroid;
                if (!this.alive) {
                    this.body.elem.remove();
                    score++;
                    this.scoreElem.innerText = score.toString();
                    if (this.laserAsteroid) {
                        this.ship.laserMode = true;
                        Observable.interval(1000)
                            .filter(_ => this.ship.laserMode)
                            .flatMap(_ => Observable.interval(500).filter(_ => this.ship.laserMode))
                            .subscribe(_ => {
                            this.ship.laserMode = false;
                        });
                    }
                    this.sound.pause();
                    this.sound.currentTime = 0;
                    this.sound.play();
                }
            }
        });
        return this.alive;
    }
    intersectsShip(ship, sound) {
        const r = this.r / 2;
        const cx = this.x + r;
        const cy = this.y;
        const shipR = ship.height / 2;
        const d = dist(cx, ship.x, cy, ship.y);
        if (d < shipR + r) {
            ship.ship.elem.remove();
            ship.alive = false;
            sound.play();
        }
    }
}
class Bullet {
    constructor(svg, cx, cy, r, dir) {
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
    move(speed) {
        const rot_rad = radians(this.dir);
        const dx = Math.sin(rot_rad);
        const dy = -Math.cos(rot_rad);
        this.cx += dx * speed;
        this.cy += dy * speed;
        this.update();
    }
    update() {
        this.elem.attr("cx", this.cx).attr("cy", this.cy);
    }
}
class Ship {
    constructor(g, x, y, rot) {
        this.bullets = [];
        this.ship = g;
        this.alive = true;
        this.x = x;
        this.y = y;
        this.rot = rot;
        this.velocity = 0;
        this.acceleration = 0.1;
        this.force = 0;
        const { height, width } = this.ship.elem.getBoundingClientRect();
        this.height = height;
        this.width = width;
        this.bullets = [];
        this.thrusting = false;
        this.dirX = 0;
        this.dirY = 0;
        this.dx = 0;
        this.dy = 0;
        this.shooting = false;
        this.laserMode = false;
    }
    rotate(dir) {
        this.rot += dir;
        this.update();
    }
    shoot(svg, sound) {
        const r = 5;
        if (!this.shooting) {
            this.bullets.push(new Bullet(svg, this.x, this.y, r, this.rot));
            sound.pause();
            sound.currentTime = 0;
            sound.play();
        }
        this.shooting = !this.laserMode;
    }
    thrust() {
        this.x += this.dirX;
        this.y += this.dirY;
        this.update();
    }
    applyForce(mult, sound) {
        if (sound.paused) {
            sound.volume = 0.2;
            sound.play();
        }
        this.thrusting = true;
        const max_speed = 18;
        this.velocity += this.acceleration;
        if (this.velocity > max_speed)
            this.velocity = max_speed;
        this.force = this.velocity * mult;
        this.setDirection();
    }
    reduceForce(mult, sound) {
        if (!sound.paused) {
            sound.pause();
            sound.currentTime = 0;
        }
        this.thrusting = false;
        this.velocity -= this.acceleration / 2;
        if (this.velocity < 0)
            this.velocity = 0;
        this.force = this.velocity * mult;
        this.dirX = this.dx * this.force;
        this.dirY = this.dy * this.force;
    }
    setDirection() {
        const rot_rad = radians(this.rot);
        this.dx = Math.sin(rot_rad);
        this.dy = -Math.cos(rot_rad);
        this.dirX = this.dx * this.force;
        this.dirY = this.dy * this.force;
    }
    update() {
        this.ship.attr("transform", `translate(${this.x} ${this.y}) rotate(${(this.rot) % 360})`);
    }
    wrap(canv) {
        if (this.x + this.width / 2 < 0) {
            this.x = canv.width + this.width / 2;
        }
        if (this.y + this.height / 2 < 0) {
            this.y = canv.height + this.height / 2;
        }
        if (this.y - this.height / 2 > canv.height) {
            this.y = -this.height / 2;
        }
        if (this.x - this.width / 2 > canv.width) {
            this.x = -this.width / 2;
        }
    }
}
const radians = (theta) => theta * (Math.PI / 180);
const rand = (min, max) => ~~(Math.random() * (max - min + 1)) + min;
const dist = (x1, x2, y1, y2) => ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5;
function asteroids() {
    const svg = document.getElementById("canvas");
    const options = {
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
    };
    const canvas = new Canvas(svg);
    const { start_x: x, start_y: y, start_theta: theta, rot_speed, force_mult } = options;
    let g = new Elem(svg, 'g')
        .attr("transform", `translate(${x} ${y}) rotate(${theta})`);
    new Elem(svg, 'polygon', g.elem)
        .attr("points", "-15,20 15,20 0,-20")
        .attr("style", "fill:lime;stroke:purple;stroke-width:1");
    const scoreElem = document.getElementById("score");
    scoreElem.innerText = score.toString();
    const keydown = Observable.fromEvent(document, 'keydown');
    const keyup = Observable.fromEvent(document, 'keyup');
    const pewSound = new Audio(options.pew_audio);
    const thrustSound = new Audio(options.thrust_audio);
    const asteroidSounds = [new Audio(options.asteroid_kill), new Audio(options.asteroid_kill2)];
    const gameOverSound = new Audio(options.game_over);
    const actions = {
        "a": (ship) => ship.rotate(-rot_speed),
        "d": (ship) => ship.rotate(rot_speed),
        "w": (ship) => ship.applyForce(force_mult, thrustSound),
        "s": (ship) => ship.reduceForce(force_mult, thrustSound),
        " ": (ship) => ship.shoot(svg, pewSound)
    };
    const enabled_keys_set = new Set();
    const ship = new Ship(g, x, y, theta);
    keydown
        .map(({ key }) => key.toLowerCase())
        .filter(key => key in actions)
        .subscribe((key) => enabled_keys_set.add(key));
    keyup
        .map(({ key }) => key.toLowerCase())
        .filter(key => enabled_keys_set.has(key))
        .subscribe((key) => enabled_keys_set.delete(key));
    let asteroid_container = [];
    const FPS = 90;
    const gameState = { ship, enabled_keys_set, asteroid_container, gameOver: false };
    const mainTimer = Observable.interval(1000 / FPS).map(_ => gameState);
    mainTimer
        .filter(({ enabled_keys_set }) => !enabled_keys_set.has('w'))
        .subscribe(({ ship }) => ship.reduceForce(force_mult, thrustSound));
    mainTimer
        .filter(({ enabled_keys_set }) => !enabled_keys_set.has(' '))
        .subscribe(({ ship }) => {
        ship.shooting = false;
    });
    Observable.interval(1000)
        .map(_ => gameState)
        .filter(({ gameOver }) => !gameOver)
        .map(_ => asteroid_container)
        .subscribe(container => {
        container.push(new Asteroid(svg, canvas, scoreElem, asteroidSounds, ship));
    });
    mainTimer
        .filter(({ ship: { alive }, gameOver }) => !alive && !gameOver)
        .subscribe((gameState) => {
        thrustSound.pause();
        gameState.gameOver = true;
        alert("You died! Total Score: " + score);
    });
    mainTimer.filter(({ gameOver }) => !gameOver).subscribe(({ enabled_keys_set, ship }) => {
        ship.thrust();
        ship.wrap(canvas);
        enabled_keys_set.forEach((key) => {
            const action = actions[key];
            action && action(ship);
        });
        ship.bullets.forEach(bullet => {
            bullet.move(5);
        });
        asteroid_container.forEach(asteroid => {
            const collides = asteroid.checkCollisions(ship.bullets);
            asteroid.intersectsShip(ship, gameOverSound);
            asteroid.move();
        });
        asteroid_container = asteroid_container.filter(({ alive }) => alive);
        const bullets = ship.bullets = ship.bullets.map(bullet => {
            bullet.alive = bullet.alive && canvas.inBounds(bullet.cx, bullet.cy, bullet.r);
            return bullet;
        });
        ship.bullets.filter(({ alive }) => !alive).forEach(({ elem }) => {
            elem.elem.remove();
        });
        ship.bullets = bullets.filter(({ alive }) => alive);
    });
}
if (typeof window != 'undefined')
    window.onload = () => {
        asteroids();
    };