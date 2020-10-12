var PIXI = require("pixi.js-legacy")
function loadClient(){ //A little hideous, but we need the script to be loaded after something else loads, so 🤷‍♂️

//PIXI config

//PIXI.settings.RESOLUTION = 0.1 //Internal resolution
//Logical height and width are the max units used in the canvas, ex. (275,225) is the center of the screen when creating an object
// Logic behind this was each tile is 50x50 units, with 100px either side for ui
// Did it work ? 450 / 8 = 56.25, so uh don't think about it too hard
var mainTimer = 0;
const logicalWidth = 550;
const logicalHeight = 450;
const colors = {
    background : 0x000000,
    //background : 0x5a855d,
    playerChain : [0x351212,0x534c24,0x885e37,0x442f1b,0x373737],
    players : [0x692424,0xa69849],
    chain : 0x000000,
    resource : [0xdbdbdb,0xe0a041,0x4184e0],
    unusedResource : [0x6d6d6d, 0x705021, 0x214270],
    uiLight : 0xa4c2f4,
    uiDark : 0x3c78d8
}
var goonList = []
var spiralList = []
var winMenus = []

//Setting up keyboard shortcuts

let keyObject = keyboard("Escape");
keyObject.press = () => {
    openGameMenu();
}

//Class declarations

class ReplayManager {
    static actionTypes = {
        button : 0,
        tile : 1
    }
    static reader = new FileReader();
    static playingReplay = false;
    static actions = [];
    static meta = {actions : ReplayManager.actions};
    static addInput(type,input){
        ReplayManager.actions.push({type:type,input:input})
    }
    static playInput(){
        let curAction = ReplayManager.actions.pop();
        if(curAction == null){
            replayMenu.endAnim.startAnim();
            return;
        }
        switch(curAction.type){
            case ReplayManager.actionTypes.button:
                buttonPress(null,curAction.input);
            break;
            case ReplayManager.actionTypes.tile:
                if(curAction.input != null){
                    tilePress(gm.grid[curAction.input.x][curAction.input.y]);
                }else{
                    tilePress();
                }
            break;
        }
    }
    static flipInputs(){
        ReplayManager.actions = ReplayManager.actions.reverse();
    }
    static saveReplay(){
        ReplayManager.flipInputs();
        saveAs(new Blob([JSON.stringify(ReplayManager.meta)], {type: "text/plain;charset=utf-8"}),"replay.3yw")
    }
    static loadFromFile(runAfter = false){
        ReplayManager.reader.onload = function(event) {
            ReplayManager.meta = JSON.parse(event.target.result);
            ReplayManager.actions = ReplayManager.meta.actions
            if(runAfter){
                ReplayManager.playingReplay = true;
                Area.changeArea(Area.areas.game);
            }
        };
        ReplayManager.clearInfo()
        var fileSelector = document.createElement('input');
        fileSelector.setAttribute('type', 'file');
        fileSelector.setAttribute('accept','.3yw')
        fileSelector.click();
        fileSelector.addEventListener("change", () => {
            ReplayManager.reader.readAsText(fileSelector.files[0]);
        });
    }
    static clearInfo(){
        ReplayManager.actions = []
        ReplayManager.meta = {actions : ReplayManager.actions}
    }
}
//To briefly describe this framework: (in case I forget 😅)
//When 
class Anim { 
    static animFuncs = {
        slide : 0,
        fade : 1,
        endGame : 2,
        pop : 3
    }
    static animPool = [];
    constructor (animFunc,args,object,speed,infinite = false,destroyOnFinish = false){
        this.animFunc = animFunc
        this.args = args
        this.speed = speed //Animations are expected to take 60 frames, divided by speed
        this.infinite = infinite
        this.progress = 0
        this.object = object
        this.destroyOnFinish = destroyOnFinish
    }
    startAnim(){
        Anim.animPool.push(this)
    }
    anim(){
        this.progress += 1/60*this.speed //Should change this to adjust for varying frame times 🤷‍♂️
        switch(this.animFunc){
            case Anim.animFuncs.slide: //Args : initPos, endPos,
                let y = (this.progress > 0.5 ? -1*(2*this.progress-2)**2 + 2 : (2*this.progress)**2)/2
                this.object.position.set(this.args.initPos.x + (this.args.endPos.x-this.args.initPos.x)*y,
                this.args.initPos.y + (this.args.endPos.y-this.args.initPos.y)*y)
                break;
            case Anim.animFuncs.endGame:
                for(var i = 0; i < 9; i++){
                    this.args[i].scale.x = Math.min(Math.max(this.progress*1.8 - Math.abs(i-4)/5,0),1)
                    console.log(this.args[i].scale.x)
                }   
            case Anim.animFuncs.pop:
                let yy = Math.sin(this.progress*Math.PI)*1.1;
                this.object.scale.set(yy,yy); 
        }
        if(this.progress >= 1){
            this.endAnim()
        }
    }
    endAnim(){
        Anim.animPool.remove(this);
        if(this.destroyOnFinish){
            this.object.destroy({children:true, texture:true, baseTexture:true});
        }
        this.progress = 0
    }
}
class Area { //The AMOUNT of infrastructure needed to make a game i s2g
    static curArea = -1
    static areas = {
        mainMenu : 0,
        stageSelection : 1,
        game : 2,
        onlineSetup : 3,
        winScreen : 4,
        tutorial : 5
    }
    static changeArea(area,index = 0){
        if(Area.curArea != -1){
            Area.unloadArea(Area.curArea)
        }
        Area.curArea = area
        Area._loadArea(Area.curArea,index)

    }
    static unloadArea(index){
        switch (index){
            case Area.areas.mainMenu:
                gfx.titleText.visible = false;
                closeMenu(mainMenu)
                break;
            case Area.areas.stageSelection:

                break;
            case Area.areas.game:
                gm.destroy();
                gfx.gameButtons.leaveAnim.startAnim()
                for(var i = 0; i < 2; i++){
                    statusMenus[i].endAnim.startAnim()
                    gfx.triangles[i].visible = false
                }
                if(gfx.online){
                    gfx.online = false
                    closeMenu(onlineMenu)
                    gfx.u[socket.curPlayer].visible = false
                }else{
                    closeMenu(gameMenu)
                }
                if(ReplayManager.playingReplay){
                    ReplayManager.playingReplay = false;
                    if(replayMenu.gfx.position.x == replayMenu.startAnim.args.endPos.x)
                    replayMenu.endAnim.startAnim();
                }
                break;
            case Area.areas.onlineSetup:
                socket.emit("notqueueing")
                closeMenu(connectingMenu)
                break;
            case Area.areas.winScreen:
                for(var i = 0; i < 2; i++){
                    closeMenu(winMenus[i])
                }
                break;
            case Area.areas.tutorial:

                break;
        }
    }
    static _loadArea(index,index2){ //underscore bc i am a dumbass and will use this instead of changeArea without it
        switch (index){
            case Area.areas.mainMenu:
                openMenu(mainMenu)
                gfx.titleText.visible = true;
                break;
            case Area.areas.stageSelection:

                break;
            case Area.areas.game:
                if(ReplayManager.playingReplay){
                    replayMenu.startAnim.startAnim();
                    gm = new GameManager(ReplayManager.meta.seed);
                }else{
                    ReplayManager.clearInfo()
                }
                gfx.gameButtons.joinAnim.startAnim()
                for(var i = 0; i < 2; i++){
                    statusMenus[i].startAnim.startAnim()
                }
                gfx.triangleParent.position.y = -60
                gfx.triangleParent.startAnim.args.initPos.y = -60
                gfx.triangles[0].visible = true
                if(!gfx.online && !ReplayManager.playingReplay){
                    var seed = new Date().toString()
                    ReplayManager.meta.seed = seed;
                    gm = new GameManager(seed);
                }
                if(gfx.online){
                    gfx.u[socket.curPlayer].visible = true
                }
                gfx.updateStats()
                break;
            case Area.areas.onlineSetup:
                openMenu(connectingMenu)
                socket.emit("QueueRequest")
                break;
            case Area.areas.winScreen:
                if(index2 == null) //if we're forfeiting
                index2 = (1+socket.curPlayer)%2
                openMenu(winMenus[index2])
                break;
            case Area.areas.tutorial:
                tutorialSlide = -1
                nextTutorialSlide()
                break;
        }
    }
}

class Menu {
    static objects = {
        button : 0,
        spirals : 1,
        text : 2,
        bar : 3
    }
    constructor(stage,light,dark,submenus,rect = new PIXI.Rectangle(logicalWidth/2-80,logicalHeight/2-85,160,190),headers = true){
        const lineWidth = 3  //Temporary* constants
        const offsetX = 0.5  //*I know myself too well, these will not be temporary
        const offsetY = 1.5/2
        let style = new PIXI.TextStyle({fontFamily : 'Vulf Mono', fontSize: 28, fill : 0xFFFFFF, align : 'left', padding : 3})

        this.submenus = submenus //Ensures we can actually access what makes up the menu

        this.bars = []

        this.gfx = new PIXI.Container(); //Root menu gfx
        this.gfx.sortableChildren = true //for headers
        this.gfx.zIndex = 1
        stage.addChild(this.gfx)
        this.box = new PIXI.Graphics(); //background box
        //Drawing box
        this.gfx.addChild(this.box)
        this.box.beginFill(dark);
        this.box.lineStyle(lineWidth, light, 1);
        this.box.drawRect(rect.x,rect.y,rect.width,rect.height)
        this.box.zIndex = 0

        let headerX = 0
        let headerY = 0 //These prevent overlapping buttons
        this.headers = []
        for(var i = 0; i < submenus.length;i++){
            let curList = submenus[i].objList
            if(headers){
            let text = new PIXI.Text(submenus[i].name,style);
            let textMetrics = PIXI.TextMetrics.measureText(submenus[i].name, style)
            textMetrics.width /= 2
            textMetrics.height /= 2 //Resolution fix
            //The lil header part. I do not know why it is like this, someone stop me from being able to program
            //not actually bad code, but I need to give in and start using sprites more
            let curHeader = new PIXI.Graphics()
            curHeader.interactive = true
            curHeader.hIndex = i
            var menuRef = this //javascript fucking blows, man
            curHeader.on("pointerup",function(e) { headerChange(e,menuRef); })
            curHeader.zIndex = 1 - 2*i*(i > 0) //Sets to 1 if it's the first header, sets to behind box if not
            this.gfx.addChild(curHeader)
            this.headers.push(curHeader) //adds to list of headers for easy re-arrangement
            let xBase = rect.x - offsetX + headerX //Saving myself Ctrl C & Ctrl V'in everywhere
            curHeader.beginFill(dark)
            curHeader.lineTo(xBase + lineWidth/2,rect.y)
            curHeader.lineStyle(lineWidth,dark,1)
            curHeader.lineTo(xBase + textMetrics.height  + textMetrics.width - lineWidth/2,rect.y)
            curHeader.lineStyle(0,0xFFFFFF)
            curHeader.lineTo(xBase,rect.y - offsetY)
            curHeader.lineStyle(lineWidth, light, 1);
            curHeader.lineTo(xBase + textMetrics.height/2,rect.y - textMetrics.height - offsetY)
            curHeader.lineTo(xBase + textMetrics.height/2  + textMetrics.width,rect.y - textMetrics.height - offsetY)
            curHeader.lineTo(xBase + textMetrics.height + textMetrics.width,rect.y - offsetY)
            text.resolution = 2
            text.position.set(rect.x+ textMetrics.height/2 + headerX,rect.y-textMetrics.height - offsetY)
            textFix(text)
            curHeader.addChild(text)
            headerX += textMetrics.height*0.75 + textMetrics.width
            }
            submenus[i].objects = new PIXI.Container();
            this.gfx.addChild(submenus[i].objects)
            const bConfig = {
                yPadding : 10,
                yWidth : 30,
                xPadding : 20,
                dShadowSize : 7
            }
            let pixelsDown = bConfig.yPadding
            for(var j = 0; j < curList.length; j++){ //For each button
                //ugly code time!!! drawing the shadow object
                switch(curList[j].type){
                    case Menu.objects.button:
                        let curShadow = new PIXI.Graphics();
                        submenus[i].objects.addChild(curShadow)
                        curList[j].shadow = curShadow
                        if(curList[j].args == "fuck js"){
                            curList[j].args = this
                        }
                        curList[j].bConfig = bConfig
                        curList[j].index = j
                        curList[j].rect = rect
                        let linePos = new Vec2(
                            rect.x + bConfig.xPadding,
                            rect.y + bConfig.yWidth + pixelsDown
                            )
                        
                        //Starts at the bottom-left, snakes around to top-right, follows button
                        curShadow.lineTo(linePos.x,linePos.y)
                        curShadow.beginFill(0x000000)
                        curShadow.lineStyle(lineWidth,0x000000)
                        linePos.x += bConfig.dShadowSize
                        linePos.y += bConfig.dShadowSize
                        curShadow.lineTo(linePos.x,linePos.y)
                        linePos.x += rect.width - bConfig.xPadding*2
                        curShadow.lineTo(linePos.x,linePos.y)
                        linePos.y -= bConfig.yWidth
                        curShadow.lineTo(linePos.x,linePos.y)
                        linePos.x -= bConfig.dShadowSize - lineWidth
                        linePos.y -= bConfig.dShadowSize - lineWidth
                        curShadow.lineTo(linePos.x,linePos.y)
                        linePos.y += bConfig.yWidth
                        curShadow.lineTo(linePos.x,linePos.y)
                        linePos.x -= rect.width - bConfig.xPadding*2
                        curShadow.lineTo(linePos.x,linePos.y)

                        let curButton = new PIXI.Graphics();
                        curList[j].gfx = curButton
                        curButton.interactive = true
                        curButton.on("pointerdown",function(e) { buttonMouseDown(e); })
                        curButton.on("pointerup",function(e) { buttonMouseUp(e); })
                        curButton.on("pointerupoutside",function(e) { buttonUpOutside(e); })
                        curButton.button = curList[j]
                        submenus[i].objects.addChild(curButton)
                        curButton.beginFill(dark)
                        curButton.lineStyle(lineWidth,light)
                        curButton.drawRect(
                            rect.x + bConfig.xPadding,
                            rect.y + pixelsDown,
                            rect.width - bConfig.xPadding*2,
                            bConfig.yWidth)
                        let text = new PIXI.Text(curList[j].text,style);
                        text.anchor.set(0.5,-0.5)
                        text.position.set(rect.x + rect.width/2,rect.y + pixelsDown)
                        textFix(text)
                        curButton.addChild(text)
                        pixelsDown += (bConfig.yPadding*2 + bConfig.yWidth)
                        break;
                    case Menu.objects.spirals:
                        let spiral = new PIXI.Graphics();
                        submenus[i].objects.addChild(spiral)
                        let space = 0.7 //0 to 1
                        let radius = 15
                        let arrowWidth = 8
                        let arrowHeight = 8
                        for(var k = 0; k < 2; k++){
                            let s = k * Math.PI
                            let initPos = {x : Math.cos (Math.PI*space + s) * radius, y : Math.sin (Math.PI*space + s) * radius}
                            spiral.lineStyle(lineWidth*1.5,0xFFFFFF)
                            spiral.arc(0,0, radius, s, Math.PI*space + s); // cx, cy, radius, startAngle, endAngle
                            spiral.lineStyle(0,0xFFFFFF);
                            let pos = new Vec2(-arrowWidth,0).rotate(Math.PI*space + s).add(initPos)
                            spiral.lineTo(pos.x,pos.y) //Rotate around 
                            spiral.lineStyle(0,0xFFFFFF);
                            pos = new Vec2(arrowWidth,0).rotate(Math.PI*space + s).add(initPos)
                            spiral.beginFill(0xFFFFFF);
                            spiral.lineTo(pos.x,pos.y)
                            pos = new Vec2(0, arrowHeight).rotate(Math.PI*space + s).add(initPos)
                            spiral.lineTo(pos.x,pos.y)
                            spiral.endFill()
                            spiral.position.set(rect.x + rect.width/2, rect.y + pixelsDown + radius)
                            spiralList.push(spiral)
                        }
                        pixelsDown += bConfig.yPadding*2 + radius
                        break;
                    case Menu.objects.text:
                        let ourStyle = new PIXI.TextStyle({fontFamily : 'Vulf Mono', fontSize: 28, fill : 0xFFFFFF, align : 'left', padding : 3, wordWrap : true, wordWrapWidth : (rect.width - bConfig.xPadding)*2})
                        if(curList[j].color != null){
                            ourStyle.fill = curList[j].color
                        }
                        let textMetrics = PIXI.TextMetrics.measureText(curList[j].text, ourStyle)
                        textMetrics.height /= 2
                        let textObj = new PIXI.Text(curList[j].text,ourStyle);
                        textObj.anchor.set(0.5,0)
                        textObj.position.set(rect.x + rect.width/2,rect.y + pixelsDown)
                        textFix(textObj)
                        submenus[i].objects.addChild(textObj)
                        pixelsDown += (bConfig.yPadding*2 + textMetrics.height)
                        break;
                    case Menu.objects.bar:
                        let subStyle = new PIXI.TextStyle({fontFamily : 'Vulf Mono', fontSize: 28, fill : 0xFFFFFF, align : 'left'})
                        let titleMetrics = PIXI.TextMetrics.measureText(submenus[i].name, subStyle)
                        titleMetrics.height /= 2
                        let titleObj = new PIXI.Text(curList[j].title,style);
                        titleObj.anchor.set(0.5,0.25)
                        titleObj.position.set(rect.x + rect.width/2,rect.y + pixelsDown)
                        textFix(titleObj)
                        submenus[i].objects.addChild(titleObj)
                        pixelsDown += (titleMetrics.height)

                        subStyle = new PIXI.TextStyle({fontFamily : 'Vulf Mono', fontSize: 28, fill : 0xFFFFFF, align : 'left'})
                        let maxMetrics = PIXI.TextMetrics.measureText(curList[j].max.toString()+"/"+curList[j].max.toString(), subStyle)
                        maxMetrics.height, maxMetrics.width /= 2;
                        //let barWidth = rect.width-bConfig.xPadding*2-maxMetrics.width
                        let barWidth = rect.width-bConfig.xPadding
                        let barParent = new PIXI.Container();
                        let bar = new PIXI.Graphics();
                        let barShadow = new PIXI.Graphics();
                        let barText = new PIXI.Text(curList[j].max.toString()+"/"+curList[j].max.toString(),subStyle);
                        textFix(barText)
                        barParent.sortableChildren = true
                        bar.zIndex = -1
                        bar.zIndex = 1
                        barParent.addChild(bar)
                        barParent.addChild(barShadow)
                        barParent.addChild(barText)
                        barParent.absMax = curList[j].max;
                        barParent.bar = bar
                        barParent.barShadow = barShadow;
                        barParent.barText = barText;
                        this.bars.push(barParent)
                        submenus[i].objects.addChild(barParent)
                        
                        barShadow.position.set(rect.x,rect.y + pixelsDown)

                        bar.position.set(rect.x,rect.y + pixelsDown)

                        //barText.anchor.set(-0.5,.5)
                        //barText.position.set(rect.x + barWidth + bConfig.xPadding,rect.y + pixelsDown)

                        barShadow.beginFill(0x000000);
                        barShadow.drawRect(bConfig.xPadding/2,-curList[j].width,barWidth,curList[i].width*2)

                        bar.beginFill(curList[j].barColor != null ? curList[j].barColor : 0xFFFFFF);
                        bar.drawRect(bConfig.xPadding/2,-curList[j].width,barWidth,curList[i].width*2)
                        this.barUpdate(barParent,5,6)
                        pixelsDown += curList[j].width*3
                        
                        //subStyle = new PIXI.TextStyle({fontFamily : 'Vulf Mono', fontSize: 28, fill : 0xFFFFFF, align : 'left'})
                        titleMetrics = PIXI.TextMetrics.measureText(submenus[i].name, subStyle)
                        titleMetrics.height /= 2
                        barText.anchor.set(0.5,0.25)
                        barText.position.set(rect.x + rect.width/2,rect.y + pixelsDown)
                        textFix(barText)
                        submenus[i].objects.addChild(barText)
                        pixelsDown += (titleMetrics.height)
                }
                
            }
            this.headerChange(0)
            closeMenu(this)
        }
    }
    headerChange(index){
        for(var i = 0; i < this.headers.length; i++){
            if(i != index){
                this.headers[i].zIndex = -Math.abs(i-index)
                this.submenus[i].objects.visible = false
            }else{
                this.headers[i].zIndex = 1
                this.submenus[i].objects.visible = true
            }
        }
    }
    barUpdate(parent,cur,max){
        parent.barText.text = cur.toString()+"/"+max.toString()
        cur = Math.min(cur,max);
        parent.bar.scale.set(cur/max,1);
    }
}

class ObjList {
    constructor(name,objList = []){
        this.name = name
        this.objList = objList
    }
}
class Button {
    constructor(text,onClick,args){
        this.text = text
        this.onClick = onClick
        this.args = args
        this.type = Menu.objects.button
    }
}
class Graphics {
    constructor(){
        
        this.renderer = PIXI.autoDetectRenderer(logicalHeight, logicalWidth, { antialias: true, roundPixels: true, resolution: 2});
        //PIXI.SCALE_MODES.DEFAULT = PIXI.SCALE_MODES.NEAREST;
        document.body.appendChild(this.renderer.view);
        // create the root of the scene graph
        this.stage = new PIXI.Container();
        this.stage.sortableChildren = true;
        this.stage.interactive = true;
        this.gamegfx = new PIXI.Container();
        this.gamegfx.sortableChildren = true
        this.stage.addChild(this.gamegfx)
        this.gameButtons = new PIXI.Container();
        this.stage.addChild(this.gameButtons)
        for(var i = 0; i < 6; i++){
            var beeTexture = new PIXI.Texture.from("buttons/"+buttonNames[i]+".png")
            var sprite = new PIXI.Sprite(beeTexture)
            sprite.indexx = i
            sprite.interactive = true
            sprite.on("pointerup",buttonPress)
            sprite.scale.set(0.07,0.07)
            sprite.position.set(20, 25+ 70*i)
            this.gameButtons.addChild(sprite)
        }
        var beeTexture = new PIXI.Texture.from("buttons/pause.png")
        var sprite = new PIXI.Sprite(beeTexture)
        sprite.interactive = true
        sprite.on("pointerup",openGameMenu)
        sprite.scale.set(0.07,0.07)
        sprite.position.set(485, 360)
        this.gameButtons.addChild(sprite)

        this.triangleParent = new PIXI.Container();
        this.stage.addChild(this.triangleParent)
        this.triangles = []
        for(var i = 0; i < 2; i++){
            this.triangles.push(new PIXI.Graphics())
            this.triangles[i].beginFill(colors.players[i])
            this.triangles[i].lineTo(0,15)
            this.triangles[i].lineTo(7.5,7.5)
            this.triangles[i].visible = false
            this.triangleParent.addChild(this.triangles[i])
        }
        this.triangleParent.startAnim = new Anim(Anim.animFuncs.slide,{initPos : {x : 5,y : this.triangleParent.position.y}, 
            endPos : {x : 5, y : 42.5 + 70*0}},this.triangleParent,3)
        this.triangleParent.position.set(5,42.5)
        this.gameButtons.joinAnim = new Anim(Anim.animFuncs.slide,{initPos:{x:this.gameButtons.position.x,y:430},endPos:{x:this.gameButtons.position.x,y:this.gameButtons.position.y}},this.gameButtons,1)
        this.gameButtons.leaveAnim = new Anim(Anim.animFuncs.slide,{initPos:{x:this.gameButtons.position.x,y:this.gameButtons.position.y},endPos:{x:this.gameButtons.position.x,y:430}},this.gameButtons,1)
        this.gameButtons.position.set(4500,4500)
        let endGameBars = []
        for(var i = 0; i < 9; i++){
            endGameBars.push(new PIXI.Graphics());
            endGameBars[i].beginFill(0xFFFFFF)
            endGameBars[i].drawRect(-logicalWidth/18,0,logicalWidth/9,logicalHeight)
            endGameBars[i].position.set(i*logicalWidth/9,0)
            endGameBars[i].zIndex = 99
            endGameBars[i].width = 0
            this.stage.addChild(endGameBars[i])

        }
        this.endGame = new Anim(Anim.animFuncs.endGame,endGameBars,this.stage,1)
        let betaText = new PIXI.Text("Tentatively Working",new PIXI.TextStyle({fontFamily : 'Vulf Mono', fontSize: 28, fill : 0xFFFFFF, align : 'right', wordWrap : true,wordWrapWidth : 2000,padding : 5}));
        this.titleText = new PIXI.Text("3 Years War",new PIXI.TextStyle({fontFamily : 'Vulf Mono', fontSize: 68, fill : 0xFFFFFF, align : 'center'}));
        textFix(betaText);
        textFix(this.titleText);
        betaText.position.set(550,432);
        betaText.anchor.set(1,0)
        this.titleText.anchor.set(0.5,0);
        this.titleText.position.set(logicalWidth/2,70)
        this.titleText.zIndex = 99
        this.stage.addChild(betaText);
        this.stage.addChild(this.titleText);
    }
    newTile(tile){
        tile.gfx = new PIXI.Container();
        tile.gfx.recursiveTile = tile
        tile.gfx.interactive = true
        tile.gfx.hitArea = new PIXI.Rectangle(-25,-25,50,50)
        tile.gfx.on("pointerup",tilePress)
        tile.gfx.sortableChildren = true
        this.gamegfx.addChild(tile.gfx);
        tile.pResource = new PIXI.Graphics();
        tile.aResource = new PIXI.Graphics();
        tile.pResource.rotation -= 0.1*Math.PI
        tile.aResource.rotation -= 0.1*Math.PI
        tile.gfx.addChild(tile.pResource);
        tile.gfx.addChild(tile.aResource);
        tile.movingFrom = new PIXI.Graphics();
        tile.movingFrom.beginFill(colors.resource[2]);
        tile.movingFrom.drawCircle(0,0,15);
        tile.movingFrom.zIndex = -2;
        tile.movingFrom.visible = false;
        tile.gfx.addChild(tile.movingFrom);
        this.updateResource(tile)
        tile.gfx.position.set(tile.pos.x*50 + 100, tile.pos.y*50 + 50)
        tile.gfx.introAnim = new Anim(Anim.animFuncs.slide,{initPos : {x:tile.gfx.position.x,y:1100*Math.floor(tile.pos.y/4)-100},endPos : tile.gfx.position.clone()},tile.gfx,(tile.pos.x + tile.pos.y)/16 + 0.8)
        tile.gfx.leaveAnim = new Anim(Anim.animFuncs.slide,{endPos : {x:tile.gfx.position.x,y:1100*Math.floor(tile.pos.y/4)-100},initPos : tile.gfx.position.clone()},tile.gfx,(tile.pos.x + tile.pos.y)/16 + 0.8,false,true)
        tile.gfx.scale.set(0.94,0.94)
        tile.gfx.introAnim.startAnim();
    }
    updateResource(tile){
        tile.pResource.clear();
        tile.aResource.clear();
        var radius = 18
        var efficient = Math.PI*2/tile.resource.max;
        if(tile.resource.max > 1){
            for(var i = 0; i < tile.resource.cur; i++){ //fuck PIXI i swear to god Google tolerates this shit ????
                tile.aResource.lineStyle(3, colors.resource[tile.resource.resourceType]);
                tile.aResource.arc(0, 0, radius, efficient*(i+0.2), efficient*(i+1)); // cx, cy, radius, startAngle, endAngle
                tile.aResource.lineStyle(0, 0xffffff);
                tile.aResource.lineTo(Math.cos (efficient*(i+1.2)) * radius,Math.sin (efficient*(i+1.2)) * radius,0)
            }
            for(var i = tile.resource.cur; i < tile.resource.max; i++){ //fuck PIXI i swear to god Google tolerates this shit ????
                tile.pResource.lineStyle(3, colors.unusedResource[tile.resource.resourceType]);
                tile.pResource.arc(0, 0, radius, efficient*(i+0.2), efficient*(i+1)); // cx, cy, radius, startAngle, endAngle
                tile.pResource.lineStyle(0, 0xffffff);
                tile.pResource.lineTo(Math.cos (efficient*(i+1.2)) * radius,Math.sin (efficient*(i+1.2)) * radius,0)
            }
        }else if(tile.resource.cur == 1){
            tile.aResource.lineStyle(3, colors.resource[tile.resource.resourceType]);
            tile.aResource.drawCircle(0, 0, radius); // cx, cy, radius, startAngle, endAngle
        }else{ //(tile.resource.cur == 0)
            tile.pResource.lineStyle(3, colors.unusedResource[tile.resource.resourceType]);
            tile.pResource.drawCircle(0, 0, radius); // cx, cy, radius, startAngle, endAngle
        }
    }
    newGroup(tile){
        tile.gfx.group = new PIXI.Graphics();
        tile.gfx.addChild(tile.gfx.group);
        tile.gfx.group.beginFill(colors.players[tile.group.owner.index]);
        tile.gfx.group.drawCircle(0, 0,12);
        tile.gfx.group.endFill();
        var goons = new PIXI.Graphics();
        tile.gfx.goonfx = goons
        goonList.push(goons)
        tile.gfx.group.addChild(goons)
        this.updateFollowers(tile)
    }
    deleteGroup(tile){
        tile.gfx.removeChild(tile.gfx.group)
        goonList.remove(tile.gfx.goonfx)
        tile.gfx.group.visible = false
        tile.gfx.goonfx.visible = false //unsure why I have to do this!
        tile.gfx.group = null
        tile.gfx.goonfx = null
    }
    updateFollowers(tile){
        tile.gfx.goonfx.clear()
        for(var i = 0; i < tile.group.followers; i++){ //fuck PIXI i swear to god Google tolerates this shit ????
            tile.gfx.goonfx.beginFill(colors.players[tile.group.owner.index])
            tile.gfx.goonfx.drawCircle(Math.cos (Math.PI/2.5*(i+1.2)) * 26,Math.sin (Math.PI/2.5*(i+1.2)) * 26,4)
            if(tile.gfx.goonfx.rotation == 0)
            tile.gfx.goonfx.rotation += 2*Math.PI*Math.random();
        }
    }
    newChain(tile,chain = null){
        tile.chainfx = new PIXI.Graphics();
        tile.chainfx.zIndex = -55
        tile.gfx.addChild(tile.chainfx)
        this.updateChain(tile,chain)
    }
    updateChain(tile,chain = null){
        tile.chainfx.clear()
        if(chain == null){
            chain = tile.chain
        }
        var color = (chain == null) ? 0xb0000f : chainColor(chain)
        var lineColor = (chain == null) ? 0xb0000f : chainColor(chain,true)
        //var color = 0xb0000f
        
        tile.chainfx.beginFill(color)
        tile.chainfx.drawCircle(0,0,8)
        tile.chainfx.endFill()
        for(var i = 0; i < testList.length; i++){
            if(tile.pos.x + testList[i].x >= 0 && tile.pos.x + testList[i].x <= 7 && tile.pos.y + testList[i].y >= 0 && tile.pos.y + testList[i].y <= 7 ){
                tile.chainfx.lineStyle(6,lineColor)
                tile.chainfx.lineTo(28*testList[i].x, 28*testList[i].y);
                tile.chainfx.lineStyle(0,0xFFFFFF)
                tile.chainfx.beginFill(color)
                tile.chainfx.drawCircle(28*testList[i].x,28*testList[i].y,3)
                tile.chainfx.endFill()
                tile.chainfx.lineStyle(0,0xFFFFFF)
                tile.chainfx.lineTo(0,0)
            }
        }
    }
    movingFrom(tile){
        tile.movingFrom.visible = true;
    }
    notMovingFrom(tile){
        tile.movingFrom.visible = false;
    }
    deleteChain(tile){
        tile.gfx.removeChild(tile.chainfx)
        tile.chainfx = null
    }
    destroy(){
        goonList = []
        for(var x = 0; x < gm.grid.length; x++){
            for(var y = 0; y < gm.grid[0].length;y++){
                gm.grid[x][y].gfx.leaveAnim.startAnim()
            }
        }
        //this.gamegfx.destroy();
        this.gamegfx = new PIXI.Container()
        this.gamegfx.sortableChildren = true;
        this.stage.addChild(this.gamegfx)
    }
    updateStats(){
        for(var i = 0; i < 2; i++){
            statusMenus[i].barUpdate(statusMenus[i].bars[0],gm.players[i].resource.build,gm.players[i].resource.maxBuild)
            statusMenus[i].barUpdate(statusMenus[i].bars[1],gm.players[i].resource.speed,gm.players[i].resource.maxSpeed)
        }
    }
    gameOver(windex){
        Area.changeArea(Area.areas.winScreen,windex);
    }
}

//helper functions

function toggleFullscreen(){
    if(!document.fullscreenElement){
        document.body.requestFullscreen();
    }else{
        document.exitFullscreen();
    }
}
function toggleMenu(menu){
    if(menu.gfx.visible){
        closeMenu(menu)
    }else{
        openMenu(menu)
    }
}
function openGameMenu(){
    if(Area.curArea == Area.areas.game && gfx.online){
        toggleMenu(onlineMenu)
    }
    if(Area.curArea == Area.areas.game && !gfx.online){
        toggleMenu(gameMenu)
    }
}
var buttonDown = null
function closeMenu(menu){
    menu.gfx.visible = false
}
function openMenu(menu){
    menu.gfx.visible = true
}
function reset(){
    if(gm != null){
        gm.destroy()
    }
    gm = new GameManager();
}
function buttonMouseDown(e){
    self = e.target.button
    self.shadow.visible = false
    self.gfx.position.x = self.bConfig.dShadowSize
    self.gfx.position.y = self.bConfig.dShadowSize
    buttonDown = self
}
function buttonMouseUp(e){
    self = e.target.button
    if(buttonDown == self){
        self.shadow.visible = true
        self.gfx.position.x = 0
        self.gfx.position.y = 0
        self.onClick(self.args)
    }
    buttonDown = null
}
function buttonUpOutside(e){
    self = e.currentTarget.button
    if(buttonDown == self){
        self.shadow.visible = true
        self.gfx.position.x = 0
        self.gfx.position.y = 0
    }
    buttonDown = null
}
function headerChange(e,menu){
    menu.headerChange(e.currentTarget.hIndex)
}
function buttonPress(fuckyou = null,otherIndex = null){
    if((gameMenu.gfx.visible || onlineMenu.gfx.visible)  && !gfx.online)
    return
    if(otherIndex != null){
        gfx.selectedButton = otherIndex
        this.indexx = otherIndex
    }
    if(!ReplayManager.playingReplay){
        ReplayManager.addInput(ReplayManager.actionTypes.button,this.indexx);
    }    
//console.log(buttonNames[this.indexx] + " pressed")
    if((gfx.online && (gm.players[socket.curPlayer].canPlay || otherIndex != null) ) || !gfx.online) {
        // if (online and (you can click or you're recieving a button) ) or you're offline
        gfx.triangles[0].visible = gm.players[0].canPlay
        gfx.triangles[1].visible = gm.players[1].canPlay
        gfx.triangleParent.startAnim.endAnim()
        gfx.triangleParent.startAnim.args.initPos.y = gfx.triangleParent.position.y
        gfx.triangleParent.startAnim.args.endPos.y = 42.5 + 70*this.indexx
        gfx.triangleParent.startAnim.startAnim()
        if(otherIndex == null && gfx.online){ //if we were the one to press the button and we're online
            socket.emit("button",this.indexx)
        }
    }
    for(var i = 0; i < 2; i++){
        if(gm.players[i].moveStart != null){
            gfx.notMovingFrom(gm.players[i].moveStart);
            gm.players[i].moveStart = null;
        }
    }
    gfx.selectedButton = this.indexx
    if(this.indexx == buttons.endTurn){
        tilePress()
        gfx.selectedButton = null
    }
}
function tilePress(tile = null,recieved = false){ //recieved via network
    if(!(tile instanceof Tile) && tile != null){
        tile = tile.currentTarget.recursiveTile
    }
    if(!ReplayManager.playingReplay){
        ReplayManager.addInput(ReplayManager.actionTypes.tile,(tile != null) ? tile.pos : null);
    }
    //console.log("Tile pressed")
    if(!gfx.online){
        if(gm.players[0].canPlay == true){
            gm.players[0].runOption(gfx.selectedButton,tile)
        }else{
            gm.players[1].runOption(gfx.selectedButton,tile)
        }
    }else{
        for(var i = 0; i < gm.players.length; i++){
            if(gm.players[i].canPlay == true){
                if(socket.curPlayer == i){
                    if(tile != null){
                        socket.emit("decision",gfx.selectedButton,{x:tile.pos.x, y : tile.pos.y})
                    }else{
                        socket.emit("decision",gfx.selectedButton,null)
                    }
                }
                if(recieved ^ socket.curPlayer == i){ //If it's (A: a recieved packet and not us) or (B: not a recieved packet and is us)
                    gm.players[i].runOption(gfx.selectedButton,tile)
                    if(tile == null){ //extremely robust solution to endTurn (help me)
                        break
                    }
                }
            }
        }
    }
    gm.playerOutline()
}
function textFix(text){
    text.scale.set(0.5,0.5)
    text.resolution = 2
}
function chainColor (chain,lines = false){
    
    if(lines){
        if(chain.owner == "Conflicted"){
            return colors.playerChain[3]
        }
        return (chain.owner == null) ? colors.playerChain[4] : colors.playerChain[chain.owner.index]
    }else{
        if(chain.owner == "Conflicted"){
            return colors.playerChain[2]
        }
        return (chain.owner == null) ? colors.unusedResource[0] : colors.players[chain.owner.index]
    }
    }
function forfeit(){
    socket.emit("leftgame")
    Area.changeArea(Area.areas.winScreen,(1+socket.curPlayer)%2)
}
var tutorialSlide = 0
var tutorialObjects = []
function nextTutorialSlide(){
    tutorialSlide += 1
    if(tutorialSlide != 0){
        closeMenu(slides[tutorialSlide-1])
    }
    openMenu(slides[tutorialSlide])
    switch (tutorialSlide){
        case 1:
            for(var i = 0; i < 4; i++){
                let ourTile = {
                    pos : {x : 6, y : 2},
                    resource : {cur : 0,max : 1,resourceType : 0},
                    group : {owner : {index : 0}, followers : 5 * (i==2)}
                }
                gfx.newTile(ourTile)
                ourTile.pResource.clear();
                ourTile.aResource.clear();
                tutorialObjects.push(ourTile)
            }
            gfx.updateResource(tutorialObjects[1])
            gfx.newGroup(tutorialObjects[0])
            gfx.newGroup(tutorialObjects[2])
            tutorialObjects[2].gfx.group.clear();
            gfx.newChain(tutorialObjects[3])
            tutorialObjects[3].gfx.zIndex = -999
            break;
        case 2:
            for(var i = 0; i < 4; i++){
                tutorialObjects[i].gfx.introAnim.args.initPos = {x : tutorialObjects[i].gfx.position.x, y : tutorialObjects[i].gfx.position.y}
                tutorialObjects[i].gfx.introAnim.args.endPos = {x : tutorialObjects[i].gfx.position.x, y : tutorialObjects[i].gfx.position.y + i*50}
                tutorialObjects[i].gfx.introAnim.startAnim()
            }
    }
}
function animate() {
    for(var i = 0; i < goonList.length; i++){
        goonList[i].rotation += 0.015
    }
    for(var i = 0; i < spiralList.length; i++){
        spiralList[i].rotation += 0.01
    }
    for(var i = 0; i < Anim.animPool.length; i++){
        Anim.animPool[i].anim()
    }
    if(Area.curArea == Area.areas.mainMenu || Area.curArea == Area.areas.winScreen || Area.curArea == Area.areas.onlineSetup){
        let areMain = (Area.curArea == Area.areas.mainMenu)
        mainTimer += 1/50 + areMain/50
        if(mainTimer >= 1){
            let maxx = getRandomInt(0,6)
            let ourTile = {
                pos : {x : getRandomInt(0,7), y : getRandomInt(0,7)},
                resource : {cur : getRandomInt(0,maxx),max : maxx,resourceType : getRandomInt(0,2)},
                group : {owner : {index : getRandomInt(0,1)}, followers : getRandomInt(0,5)}
            }
            gfx.newTile(ourTile)
            gfx.newGroup(ourTile)
            goonList.remove(ourTile.gfx.goonfx)
            
            new Anim(Anim.animFuncs.pop,null,ourTile.gfx,0.35 + 0.35*areMain,false,true).startAnim()
            ourTile.gfx.introAnim.endAnim()
            ourTile.gfx.scale.set(0,0)
            ourTile.gfx.zIndex = -99
            ourTile.gfx.interactive = false
            mainTimer = 0
        }
    }
    gfx.renderer.render(gfx.stage);
    requestAnimationFrame( animate );
}
//resize code from stackoverflow
const resizeHandler = () => {
    const scaleFactor = Math.min(
      window.innerWidth / logicalWidth,
      window.innerHeight / logicalHeight
    );
    const newWidth = Math.floor(logicalWidth * scaleFactor);
    const newHeight = Math.floor(logicalHeight * scaleFactor);
    
    //gfx.renderer.view.style.width = `${newWidth}px`;
    //gfx.renderer.view.style.height = `${newHeight}px`;
  
    gfx.renderer.width = newWidth/PIXI.settings.RESOLUTION;
    gfx.renderer.height = newHeight/PIXI.settings.RESOLUTION;

    gfx.renderer.resize(newWidth/PIXI.settings.RESOLUTION, newHeight/PIXI.settings.RESOLUTION);
    gfx.stage.scale.set(scaleFactor/PIXI.settings.RESOLUTION); 
  };

//Graphics declaration (declared here bc menu declaration relies on them)

gfx = new Graphics();

// UI Declaration

var slides = [
    new Menu(gfx.stage, colors.uiLight, colors.uiDark, [new ObjList("nope",[{type : Menu.objects.text, text : "Welcome to the tutorial for Three Years War! Hit the next button to continue."},new Button("Next",nextTutorialSlide)])],undefined,false),
    new Menu(gfx.stage, colors.uiLight, colors.uiDark, [new ObjList("nope",[{type : Menu.objects.text, text : "This is what a typical game in Three Years War looks like."},new Button("Next",nextTutorialSlide)])],undefined,false),
    new Menu(gfx.stage, colors.uiLight, colors.uiDark, [new ObjList("nope",[{type : Menu.objects.text, text : "The four parts of a tile are: The Chief, The Resource, The Followers, and The Chain (listed in order)."},new Button("Next",nextTutorialSlide)])],undefined,false)
]
gameMenu = new Menu(gfx.stage,colors.uiLight,colors.uiDark,
[new ObjList("Menu",[new Button("Reset",reset),new Button("Main Menu",Area.changeArea,Area.areas.mainMenu),new Button("Exit Menu",closeMenu,"fuck js")]),
new ObjList("Options",[new Button("Save Replay",ReplayManager.saveReplay),new Button("Fullscreen",toggleFullscreen)])]
)
onlineMenu = new Menu(gfx.stage,colors.uiLight,colors.uiDark,
    [new ObjList("Menu",[new Button("Forfeit",forfeit),new Button("Exit Menu",closeMenu,"fuck js")]),
    new ObjList("Options",[new Button("Save Replay",ReplayManager.saveReplay),new Button("Fullscreen",toggleFullscreen)])]
    )
mainMenu = new Menu(gfx.stage, colors.uiLight,colors.uiDark, [
new ObjList("Menu", [new Button("Play Locally",Area.changeArea,Area.areas.game),new Button("Play Online",Area.changeArea,Area.areas.onlineSetup), new Button("Play Tutorial",Area.changeArea,Area.areas.tutorial)]),
new ObjList("Options", [new Button("Fullscreen",toggleFullscreen),new Button("Open Replay",ReplayManager.loadFromFile,true)])]
)
connectingMenu = new Menu(gfx.stage, colors.uiLight,colors.uiDark, [
new ObjList("Menu", [{type : Menu.objects.spirals},{type : Menu.objects.text, text : "Connecting..."},new Button("Cancel",Area.changeArea,Area.areas.mainMenu)])]
,new PIXI.Rectangle(logicalWidth/2-100,logicalHeight/2-65,200,130),false)
statusMenus = [new Menu(gfx.stage, colors.uiLight,colors.players[0], [
    new ObjList("Player 1", [{type : Menu.objects.bar, max : 6, width : 2, title : "Build", barColor : colors.resource[1]},{type : Menu.objects.bar, max : 6, width : 2, title : "Speed", barColor : colors.resource[2]}])],new PIXI.Rectangle(475,150,70,85)
    ),
    new Menu(gfx.stage, colors.uiLight,colors.players[1], [
        new ObjList("Player 2", [{type : Menu.objects.bar, max : 6, width : 2, title : "Build", barColor : colors.resource[1]},{type : Menu.objects.bar, max : 6, width : 2, title : "Speed", barColor : colors.resource[2]}])],new PIXI.Rectangle(475,260,70,85))
]
for(var i = 0; i < 2; i++){
    statusMenus[i].startAnim = new Anim(Anim.animFuncs.slide,
        {initPos : {x : 450, y : statusMenus[i].gfx.position.y},endPos : {x : statusMenus[i].gfx.position.x, y : statusMenus[i].gfx.position.y} },statusMenus[i].gfx,1)
    statusMenus[i].endAnim = new Anim(Anim.animFuncs.slide,
        {endPos : {x : 450, y : statusMenus[i].gfx.position.y},initPos : {x : statusMenus[i].gfx.position.x, y : statusMenus[i].gfx.position.y} },statusMenus[i].gfx,1)
    statusMenus[i].gfx.position.set(800,800)
    openMenu(statusMenus[i])
    winMenus.push(new Menu(gfx.stage,colors.uiLight,colors.uiDark,
        [new ObjList("Menu",[{type:Menu.objects.text,text:"Player " + (i+1).toString() + " Won!", color : colors.players[i] + 0x2F2F2F*i},new Button("Main Menu",Area.changeArea,Area.areas.mainMenu),new Button("Save Replay",ReplayManager.saveReplay)])]
        ,undefined,false))
}
var replayMenu = new Menu(gfx.stage, colors.uiLight,colors.uiDark, [
    new ObjList("Replay", [new Button("▶",ReplayManager.playInput)])],new PIXI.Rectangle(475,50,70,60))
openMenu(replayMenu)
replayMenu.startAnim = new Anim(Anim.animFuncs.slide,
    {initPos : {x : 450, y : replayMenu.gfx.position.y},endPos : {x : replayMenu.gfx.position.x, y : replayMenu.gfx.position.y} },replayMenu.gfx,1)
replayMenu.endAnim = new Anim(Anim.animFuncs.slide,
    {endPos : {x : 450, y : replayMenu.gfx.position.y},initPos : {x : replayMenu.gfx.position.x, y : replayMenu.gfx.position.y} },replayMenu.gfx,1)
replayMenu.gfx.position.set(5000,5000)
gfx.u = []
for(var i = 0; i < 2; i++){ //Adding in online U's for use later
    gfx.u.push(new PIXI.Text("U",new PIXI.TextStyle({fontFamily : 'Vulf Mono', fontSize: 28, fill : 0xFFFFFF, align : 'left'})))
    textFix(gfx.u[i])
    statusMenus[i].gfx.addChild(gfx.u[i])
    gfx.u[i].zIndex = 5000
    gfx.u[i].position.set(532,218+110*i)
    gfx.u[i].visible = false
}

// Game initialization!

resizeHandler();
animate();
gm = null;
Area.changeArea(Area.areas.mainMenu);
var socket = io();
window.addEventListener('resize', resizeHandler, false);

//Networking

socket.on('connect', () => {
    console.log("connected")
  });
socket.on("matchStart", (playerNum,seed) => {
    socket.curPlayer = playerNum ? 1 : 0
    console.log("match started")
    gfx.online = true
    ReplayManager.meta.seed = seed;
    gm = new GameManager(seed);
    Area.changeArea(Area.areas.game)
})
socket.on("decision", (type, tile) => {
    gfx.selectedButton = type
    if(tile != null){
        tilePress(gm.grid[tile.x][tile.y],true)
    }else{
        tilePress(null,true)
    }
})
socket.on("button", (type) => {
    buttonPress(null,type)
})
socket.on("matchClosed", () => {
    if(Area.curArea != Area.areas.winScreen){
    Area.changeArea(Area.areas.winScreen,socket.curPlayer)
    console.log("pain");
    }
})
}
