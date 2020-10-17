
//Not my code, adds something that removes by value (which I need :(  ))
Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};
//Again, not mine, thx stackoverflow! This allows me to dynamically load html pages (for different graphics packages)
//function load_home() {
//    document.getElementById("content").innerHTML='<object type="text/html" data="basic.html" ></object>';
//}
class Vec2{
    constructor(x, y) {
        this.x = x
        this.y = y
    }
    add(z){
        return new Vec2(this.x + z.x,this.y + z.y)
    }
    moveDist(z){
        return Math.max(Math.abs(this.x-z.x),Math.abs(this.y-z.y))
    }
    inList(z){
        for(var i = 0; i < z.length; i++){
            if(z[i].x == this.x && z[i].y == this.y){
                return true
            }
        }
        return false
    }
    rotate(radian){
        return new Vec2(this.x*Math.cos(radian)-this.y*Math.sin(radian),this.y*Math.cos(radian) + this.x*Math.sin(radian))
    }
}
class Group{
    constructor(owner,followers = 0){
        this.owner = owner
        this.owner.groups += 1
        this.followers = followers
    }
}
const resourceType = {
    none: 0,
    build: 1,
    speed: 2
}
class tileResource{ //whoops
    constructor(type,max){
        this.resourceType = type //use resourceType!
        this.max = max
        this.cur = 0
    }
}
class Resource{
    constructor(speed,build){
        this.maxSpeed = speed;
        this.maxBuild = build;
        this.speed = 0;
        this.build = 0;
    }
    equals(z){
        return this.maxBuild == z.maxBuild && this.maxSpeed == z.maxSpeed && this.build == z.build && this.speed == z.speed;
    }
    add(z){ //Doesn't use maxes
        this.build += z.build
        this.speed += z.speed
    }
}
class Tile{
    constructor(pos,gameManager,group = null, resource = null){
        this.pos = pos;
        this.group = group;
        this.chain = null;
        this.game = gameManager;
        if(resource != null){
            this.resource = resource; //Max is max for that tile, normal is how much has been built
        }else{
            this.resource = new tileResource(resourceType.none,1);
        }
        gfx.newTile(this)
        if(group != null){
            gfx.newGroup(this)
        }
    }
    createChain(){ 
        this.chain = new Chain(this)
    }
}

// CHAIN DOCUMENTATION ⛓

//Chains are created by a tile creating one where it is the only link.
//After that, a recursive check is done to merge this tile with all other chains potentially surrounding it (chainMerge)
//After building our final list, we set each tile's chain reference to this chain
//After that, this loops through all tiles in our new chain and calculates the total resources it provides, and who owns it (chainCheck)

var testList = [new Vec2(1,1),new Vec2(-1,1),new Vec2(1,-1),new Vec2(-1,-1)] //A list of nearby stuff to check

class Chain{
    constructor(origin){ //Created whenever a Tile has a new building
        this.tiles = [origin]
        if(origin.group != null){
            this.owner = origin.group.owner
        }else{
            this.owner = null
        }
        this.resource = new Resource(0,0) //Uses exclusively build & speed, maxes are set to 0
        if(origin.resource.resourceType == resourceType.build){
            this.resource.maxBuild += origin.resource.cur
        }else if(origin.resource.resourceType == resourceType.speed){
            this.resource.maxSpeed += origin.resource.cur
        }
        origin.game.chains.push(this)
        gfx.newChain(origin,this)
        this.chainMerge()
        gfx.updateChain(origin,this)
    }
    chainMerge(){ //Checks for any otherwise missed merges, then updates the resource count to be accurate
        var mergeNeeded = false
        for(var i = 0; i < this.tiles.length && !mergeNeeded; i++){ //For each tile in the chain 
        for(var j = 0; j < testList.length; j++){ //For each possible place
            var testTile = this.tiles[0].game.tileAt(this.tiles[i].pos.add(testList[j]))
            if(testTile != null && testTile.resource.cur > 0 && testTile.chain != this && !this.tiles.includes(testTile)){ //If there's a tile there and it can be part of a chain and that chain is not our chain
                mergeNeeded = true //Signal that we should check again
                this.owner.game.chains.remove(testTile.chain) //Remove other chain from list of chains
                testTile.chain = this
                this.tiles.push(testTile)
                //this.tiles = this.tiles.concat(testTile.chain.tiles) //Combine our chains
                //for(var k = 0; k < this.tiles.length; k++){
                    //this.tiles[k].chain = this
                //}    
                 //Remove chain from global list of chains (This game will NOT be a memory leak!)
                //testTile.chain.deleteChain(this) //Remove our old chain (and ensures this chain is the one we'll be using on each tile)
                break
            }
        }
        }
        if(mergeNeeded == true){
            this.chainMerge()
        }else{
            this.chainCheck()
        }
    }
    chainCheck(){ //Re-evaluates the chain's total resources & ownership 
        this.resource = new Resource(0,0)
        this.owner = null
        for(var i = 0; i < this.tiles.length; i++){
            if(this.tiles[i].resource.resourceType == resourceType.build){
                this.resource.maxBuild += this.tiles[i].resource.cur
            }else if(this.tiles[i].resource.resourceType == resourceType.speed){
                this.resource.maxSpeed += this.tiles[i].resource.cur
            }
            if(this.owner == null && this.tiles[i].group != null && this.tiles[i].group.owner != this.owner){
                this.owner = this.tiles[i].group.owner
            }
            if(this.owner != null && this.tiles[i].group != null && this.tiles[i].group.owner != this.owner){
                this.owner = "Conflicted"
            }
        }
        for(var i = 0; i < this.tiles.length; i++){
            gfx.updateChain(this.tiles[i])
        }
        for(var x = 0; x < this.tiles[0].game.players.length; x++){
            this.tiles[0].game.playerMax(this.tiles[0].game.players[x])
        }
    }

}

//Implemented:
//Chains via the createChain method on a tile
//The framework and classes that will be used
//move and build

//Not implemented:
//Higher-level game logic (turn order, etc.)
//Some other actions
//Raze doesn't work (chainMerge doesn't discover properly, gm.grid[0][0].resource.cur being touched by something I am not aware of)
//Events for graphical stuff
class Player{ //Calls to player actions don't assume trust (i.e., I could try to move when I am unable to)
    constructor(game,index){
        this.resource = new Resource(1,1);
        this.spawnList = []
        this.game = game
        this.canPlay = false
        this.index = index
        this.groups = 0;
    }
    runOption(index,tile){
        switch(index){
            case buttons.move:
                this.move(tile)
                break;
            case buttons.buildGroup:
                this.spawnGroup(tile)
                break;
            case buttons.buildQuarry:
                this.build(tile)
                break;
            case buttons.buildFollower:
                this.addFollower(tile)
                break;
            case buttons.raze:
                this.raze(tile)
                break;
            case buttons.endTurn:
                this.endTurn()
                break;
        }
    }
    build(tile){
        if(this.canPlay && tile.group != null && tile.group.owner == this && tile.resource.cur < tile.resource.max){
            if(tile.group.followers + this.resource.build >= 2){
                this.resource.build -= Math.max(2-tile.group.followers,0)
                tile.group.followers = Math.max(tile.group.followers - 2,0)
                gfx.updateFollowers(tile)
                tile.resource.cur += 1
                gfx.updateResource(tile)
                if(tile.resource.cur == 1){ //If this is the first time it's been built
                    tile.createChain() //Create a chain for it!
                }else{
                    tile.chain.chainCheck()
                }
            }
        }
    }
    endTurn(){ //If you change this, remember that it could conflict with our implementation of move
        if(this.canPlay){
            this.resource.build = 0
            this.resource.speed = 0
            gm.turnOver()
            this.canPlay = false
            this.moveStart = null
        }
    }
    startTurn(){ //Same thing goes here
        this.resource.build += this.resource.maxBuild
        this.resource.speed += this.resource.maxSpeed
        this.canPlay = true
    }
    move(tile){
        if(this.moveStart == null){
            this.moveStart = tile
            gfx.movingFrom(tile);
            return
        }else{
            var destTile = tile
            tile = this.moveStart
            gfx.notMovingFrom(tile);
            this.moveStart = null
        }
        if(this.canPlay && tile.group != null && (!destTile.group != null || tile.group.owner != this) // If there's a group our start, and (if there's a group on the destination tile, we don't own it)
            && tile.group.owner == this && tile.pos.moveDist(destTile.pos) <= this.resource.speed){ //If we own the tile and we actually have the speed to move there
            this.resource.speed -= tile.pos.moveDist(destTile.pos)
            var nomadicGroup = tile.group
            gfx.deleteGroup(tile)
            tile.group = null
            if(tile.chain != null){
                tile.chain.chainCheck()
            }
            if(destTile.group == null){
                destTile.group = nomadicGroup
                gfx.newGroup(destTile)
                if(destTile.chain != null){
                    destTile.chain.chainCheck()
                }
                return
            }
            if(nomadicGroup.followers >= destTile.group.followers){
                destTile.group.owner.resource.build += destTile.group.followers + 1
                destTile.group.owner.resource.speed += destTile.group.followers + 1
                nomadicGroup.followers -= destTile.group.followers
                if(nomadicGroup.followers == destTile.group.followers){ //All of the same code as when we have an equal amount, but there won't be anything there; therefore all we need is to turn this to null
                    gfx.deleteGroup(destTile)
                    destTile.group.owner.groups -= 1
                    this.groups -= 1
                    destTile.group = null
                }else{
                    destTile.group.followers -= 1
                    destTile.group.owner.groups -= 1
                    destTile.group = nomadicGroup
                }
                if(destTile.chain != null){
                    destTile.chain.chainCheck()
                }
            }else{//When destTile has more stuff
                this.groups -= 1
                destTile.group.followers -= nomadicGroup.followers + 1
            }
            if(destTile.group != null){
                gfx.deleteGroup(destTile)
                gfx.newGroup(destTile)
            }
            if(this.groups == 0){
                this.game.gameOver((1+this.index)%2)
            }else if(gm.players[(1+this.index)%2].groups == 0){
                this.game.gameOver(this.index)
            }
        }
    }
    addFollower(tile){
        if(this.canPlay && tile.group != null && tile.group.owner == this && tile.group.followers < 5 && this.resource.build > 0){
            tile.group.followers += 1
            this.resource.build -= 1
            gfx.updateFollowers(tile)
        }
    }
    spawnGroup(tile){
        if(this.canPlay && tile.group == null && tile.pos.inList(this.spawnList) && this.resource.build > this.groups - 1 && this.resource.speed > this.groups - 1){
            this.resource.build -= this.groups - 1
            this.resource.speed -= this.groups - 1
            tile.group = new Group(this)
            gfx.newGroup(tile)
        }
    }
    raze(tile){
        if(this.canPlay && tile.group != null && tile.group.owner == this){
            gfx.deleteGroup(tile)
            if(tile.chain != null){
                gfx.deleteChain(tile)
                this.game.chains.remove(tile.chain)
                tile.chain = null
                for(var i = 0; i < testList.length; i++){
                    var tileChanged = this.game.tileAt(tile.pos.add(testList[i]))
                    if(tileChanged.resource.cur > 0){
                        tileChanged.chain = new Chain(tileChanged)
                    }
                }
            }
            tile.group = null
            tile.resource = new tileResource(resourceType.none,1)
            gfx.updateResource(tile)
            this.groups -= 1
            if(this.groups == 0){
                this.game.gameOver((1+this.index)%2)
            }
        }
    }
}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
class GameManager{
    constructor(seed = null){
        this.players = [new Player(this,0),new Player(this,1)];
        this.grid = this.basicGrid(seed);
        this.players[0].startTurn()
        this.chains = []
    }
    // Listen for the event.
    basicGrid(seed){
        if(seed != null){
            Math.seedrandom(seed);
            //console.log(seed)
        }
        var tempGrid = []
        var resources = []
        for(var x = 0; x < 8; x++){
            tempGrid.push([])
            for(var y = 0; y < 8; y++){
                tempGrid[x].push(0)
            }
        }
        while(resources.length < 8){
            var testVec = new Vec2(getRandomInt(0,7),getRandomInt(2,3))
            var alreadyThere = false
            for(var j = 0; j < resources.length; j++){
                alreadyThere = alreadyThere || (testVec.x == resources[j].x && testVec.y == resources[j].y)
            }
            if(!alreadyThere){
                resources.push(testVec)
                var max = getRandomInt(1,6)
                var type = Math.floor(resources.length/4 + 0.75)
                tempGrid[testVec.x][testVec.y] = new Tile(resources[resources.length-1],this,null,new tileResource(type,max))
                tempGrid[7-testVec.x][7-testVec.y] = new Tile(new Vec2(7-testVec.x,7-testVec.y),this,null,new tileResource(type,max))
            }
        }
        for(var i = 0; i < 3; i++){
            tempGrid[i*3][0] = new Tile(new Vec2(i*3,0),this,new Group(this.players[0]))
            tempGrid[i*3+1][7] = new Tile(new Vec2(i*3+1,7),this,new Group(this.players[1]))
        }
        for(var i = 0; i < 8; i++){
            this.players[0].spawnList.push(new Vec2(i,0))
            this.players[1].spawnList.push(new Vec2(i,7))
        }
        for(var x = 0; x < 8; x++){
            for(var y = 0; y < 8;y++){
                if (tempGrid[x][y] == 0){
                    tempGrid[x][y] = new Tile(new Vec2(x,y),this); 
                }
            }
        }
        return tempGrid;
    }
    turnOver(){
        for(var i = 0; i < this.players.length; i++){
            if(this.players[i].canPlay == false){
                this.players[i].startTurn()
            }
        }
    }
    tileAt(coords){ //Returns a reference to the tile at Vec2
        try{
            return this.grid[coords.x][coords.y]
        }catch(err){
            return null
        }
    }
    playerMax(player){ //Sets a player's resource Maxes to the right amount
        player.resource.maxSpeed = 1
        player.resource.maxBuild = 1
        for(var i=0;i<this.chains.length;i++){
            if(this.chains[i].owner == player){
                player.resource.maxBuild += this.chains[i].resource.maxBuild
                player.resource.maxSpeed += this.chains[i].resource.maxSpeed
            }
        }
    }
    playerOutline(){
        //for(var i = 0; i < this.players.length; i++){
        //    console.log("Player %d: Build: %d -- Speed: %d -- Max Build: %d -- Max Speed %d",
        //                i+1,this.players[i].resource.build,this.players[i].resource.speed,this.players[i].resource.maxBuild,this.players[i].resource.maxSpeed)
        //}
        gfx.updateStats()
    }
    destroy(){ //Used so that we are not a giant memory leak/visual bug masquerading as a game
        gfx.destroy()
    }
    gameOver(winnerIndex){
        gfx.gameOver(winnerIndex)
    }
}

const buttons = {
    move : 0,
    buildGroup : 1,
    buildQuarry : 2,
    buildFollower : 3,
    raze : 4,
    endTurn : 5
}
const buttonNames = ["move","buildGroup","buildQuarry","buildFollower","raze","endTurn"]

//To use this, create a global Graphics object called gfx (my b 😅), then call a new GameManager object
