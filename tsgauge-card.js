const CARD_VERSION = '0.1.0';
const CARD_NAME = "HA-TSGAUGE-CARD";
console.info(
  `%c  ${CARD_NAME}  %c  Version ${CARD_VERSION}  `,
    'color: white; font-weight: bold; background: crimson',
    'color: #000; font-weight: bold; background: #ddd',
);

class TSgaugeCard extends HTMLElement {

    setConfig(config) {
      if(!config.entities) {
        throw new Error("You need to define an entities");
      }
      this.config=config;
    }

    getCardSize() {
      if(this.barData) return math.trunc((this.barData.length*this.metric.bar_h)/50);
      else return 1; 
    }

  set hass(hass) {

      this._hass=hass;

      // Initialize the content if it's not there yet.
      if(!this.canvas) {


        // Define color constant
        this._compStyle=getComputedStyle(document.getElementsByTagName('body')[0]);
        this.fonts={}
        this.fonts.name=this._compStyle.getPropertyValue("--paper-font-body1_-_font-size")+" "+this._compStyle.getPropertyValue("--paper-font-body1_-_font-family"); 

        this.barData=[];
   
        // Check config for generate preview card
        if(this.config.entities&&Array.isArray(this.config.entities)&&this.config.entities.length==1&&this.config.entities[0].entity&&this.config.entities[0].entity=="<enter base entity name>") {
        
          // Create full the object copy for prevent use preview configuration
          this.config=JSON.parse(JSON.stringify(this.config));

          this.config.title=null;
          this.config.entities=[];
          for(let i in this._hass.states) {
            if(i.startsWith("sensor.")&&i.endsWith("_power")) {
              console.log(i);
              console.dir(this._hass.states[i]);
              if(this.config.entities.push({entity:i,icon:"mdi:power-socket-de",name:this._hass.states[i].attributes.friendly_name})>3) break;
            }
          }

      }

      
      if(this.config.entities) {
        
        // Prepare entity array
        let a=Array.isArray(this.config.entities)?this.config.entities:[this.config.entities];
        for(let i in a) this.barData.push({ut:a[i].name??"",t:"",m:"",e:a[i].entity,i:a[i].icon,d:0,h:null,st:a[i].state??null,bar_fg:a[i].barcolor??null});  
          //ut-user name e-entity i-icon d-cur.data h-hist.data st-entity on/off bar_fg-individual bar color 
        }

        // Define metrics
        this.metric={}
        this.metric.padding=10;
        this.metric.iconsize=parseInt(this._compStyle.getPropertyValue("--paper-font-headline_-_font-size"));//24;//  style.getPropertyValue("--mdc-icon-size");
        this.metric.iconwidth=this.metric.iconsize;
        this.metric.chartwidth=146;

        this.size_w = Math.max(this.config.width??300,this.offsetWidth);
        this.size_h = Math.max(this.config.height??(this.barData.length>0?this.barData.length*(this.metric.iconsize*2):200),this.offsetHeight);

        // Calc bar height
        if(this.barData.length) {
          this.metric.bar_h=(this.size_h-this.metric.padding)/this.barData.length;
        }

        // Range
        this.maxpos=this.config.rangemax>0?this.config.rangemax:2000; 
        // Convert range value to log10 scale
        this.maxposraw=this.maxpos;

        switch(this.config.scaletype?this.config.scaletype.toLowerCase():"log10") {
          case "linear": break;
          case "log10": this.maxpos=Math.log10(this.maxpos);break;
        } 
      
        // Create card content
        let cnthtml=`<ha-card header="${this.config.title??''}" style="line-height:0;"><div style="position:relative;">`
        cnthtml+=   ` <canvas class="card-content" width="${this.size_w}px" height="${this.size_h}px" tabindex="1" style="border-radius: var(--ha-card-border-radius,12px); padding:0"></canvas>`

        // Add icon element
        for(let i in this.barData) {
          if(this.barData[i].i) {
            let edata="";
            if(this.barData[i].st) {
              edata='data-entity="'+this.barData[i].st+'"';
            }
            cnthtml+=`<ha-icon id="tdvbar_${i}" icon="${this.barData[i].i}" ${edata} style="${edata?"cursor:pointer;":""} position: absolute; left:${this.metric.padding}px; top:${this.metric.bar_h*i+this.metric.padding+(((this.metric.bar_h-this.metric.padding)-this.metric.iconsize)/2)}px;"></ha-icon>`;//+(((this.metric.bar_h-this.metric.padding)-this.metric.iconsize)/2)
          }  
        } 

        cnthtml+=   `</div></ha-card>`;
        this.innerHTML=cnthtml;

        this.canvas=this.querySelector("canvas");
        this.ctx=this.canvas.getContext("2d");
        // Calc font metric
        this.ctx.save();
        this.ctx.font=this.fonts.name;
        let m=this.ctx.measureText("AQq");
        this.metric.nameheight=m.fontBoundingBoxAscent+m.fontBoundingBoxDescent+5;
        this.ctx.restore();
        //-------------------------------
        // set click event handler 
        this.querySelectorAll("ha-icon").forEach(elAnchor=> {
          elAnchor.addEventListener("click",(ev)=> {
            let e=ev.target.getAttribute("data-entity"); 
            if(e) {
              ev.stopPropagation();
              //hass.callService("switch", "toggle", {entity_id:e});
              this._fire("hass-more-info", { entityId: e });
            }
          });
        });

      this.canvas.addEventListener("click",(ev)=>
       {
        ev.stopPropagation();
        let x,y;
        if(ev.offsetX||ev.offsetY){x=ev.offsetX;y=ev.offsetY;} else {x=ev.layerX;y=ev.layerY;} 
        if(this.metric.bar_h&&this.barData&&this.barData.length) 
         {
          let itemnum=Math.trunc(y/this.metric.bar_h);
          if(itemnum>=0&&itemnum<this.barData.length)
           {
            this._fire("hass-more-info", { entityId:this.barData[itemnum].e});
           }
         }
       });
      //-------------------------------
      new ResizeObserver(()=>
       {
//console.log("ResizeObserver");
//debugger
        this.size_w=this.offsetWidth;//this.parentElement.clientWidth-8;//this.clientWidth;
        //console.log('content dimension changed',this.clientWidth,this.clientHeight);
        this.canvas.width=this.size_w-2;
        //this.Context.canvas.height=this.h;

       }).observe(this);


   }

  }


  static getStubConfig()
   {
    //debugger
    return {title:"Optional card title",
            rangemax:2000, 
            entities:[{entity:"<enter base entity name>",
                       name:  "Parameter name",
                       icon:  "mdi:power-socket-de",
                       state: "<enter switch entity name>"}] 
           }
   }
 }

customElements.define("tsgauge-card", TSGaugeCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tsgauge-card",
  name: "TSGAUGE CARD",
  preview: true, // Optional - defaults to false
  description: "Simple Javascript to display gauges", // Optional
  documentationURL: "https://github.com/trollix/ha-tsgauge-card"
});
