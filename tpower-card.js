const CARD_VERSION = '0.1.1';
const CARD_NAME = "HA-TPOWER-CARD";
console.info(
  `%c  ${CARD_NAME}  %c  Version ${CARD_VERSION}  `,
    'color: white; font-weight: bold; background: crimson',
    'color: #000; font-weight: bold; background: #ddd',
);

class TPowerCard extends HTMLElement {

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
        this.GroupBySec=600; //10 minits
        this.MaxHistStep=(24*60*60)/this.GroupBySec; 

        // Define color constant
        this._compStyle=getComputedStyle(document.getElementsByTagName('body')[0]);
        this.fonts={}
        this.fonts.name=this._compStyle.getPropertyValue("--paper-font-body1_-_font-size")+" "+this._compStyle.getPropertyValue("--paper-font-body1_-_font-family"); 

        this._rebuildColorValue();

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
        this._drawBarContent();
       }).observe(this);

      //this.prepareTimeRangeForHistReq();
      // if some bar defined start history data requester timer
      if(this.barData.length)
       {
        setTimeout(TPowerCard._reqHistEntityData,100,this,0);
       }
     }
    //----------------------------------
    // Applay data
    for(let i in this.barData)
     {
      if(hass.states[this.barData[i].e])
       {
        this.barData[i].d=+hass.states[this.barData[i].e].state;
        this.barData[i].t=this.barData[i].ut??(hass.states[this.barData[i].e].attributes.friendly_name??hass.states[this.barData[i].e].entity_id);
        this.barData[i].m=hass.states[this.barData[i].e].attributes.unit_of_measurement;
       }
      else
       {
        this.barData[i].d=0;
        this.barData[i].t="";
        this.barData[i].m="";
       }

      let icon=this.querySelector(`#tdvbar_${i}`);
      if(icon)
       {
        let ison=false;
        if(this.barData[i].st&&hass.states[this.barData[i].st]) ison=(hass.states[this.barData[i].st].state=="on");
        else ison=(this.barData[i].d>0);//if on/off entity state is not defined the use base state
        icon.style.color=ison?this.colors.iconon:this.colors.iconoff;
       }
     } 
    this._drawBarContent();
   }
//#################################################################################################
  _fire(type, detail, options)
   {
    options= options || {};
    detail= (detail === null || detail === undefined) ? {} : detail;
    const event = new Event(type,
     {
      bubbles: options.bubbles === undefined ? true : options.bubbles,
      cancelable: Boolean(options.cancelable),
      composed: options.composed === undefined ? true : options.composed
     });
    event.detail = detail;
    this.dispatchEvent(event);
    return event;
   }
//#################################################################################################
  static async _reqHistEntityData(This,baridx)
   {
    if(baridx==0)
     {
      let curdate=This._roundDate(new Date());
      This.CurMoment=curdate.getTime();///1000;
      This.StartMoment=This.CurMoment-(24*60*60*1000);// one day
     }
    let data_raw=await This._fetchRecent(This.barData[baridx].e,null,null,false,false);
    if(data_raw&&data_raw.length&&data_raw[0]&&data_raw[0].length)
     {
      let data=data_raw[0];
      This.barData[baridx].h=[]; // Reset history array

      let latestval=null;
      let pervidx=null;
      for(let i in data)
       {
        let d=Math.trunc(new Date(data[i].last_changed).getTime());
        if(d>=This.StartMoment)
         {
          // calculate date index for array
          let rd=This._roundDate(new Date(d))
          let idx=(This.CurMoment-rd)/(This.GroupBySec*1000);
          // fill skipped array element
          if(pervidx!=null&&(pervidx+1)>idx)
           {
            for(;pervidx>idx;pervidx--)
             {
              if(!isNaN(latestval)) This.barData[baridx].h[pervidx]=Math.max(latestval,This.barData[baridx].h[pervidx]??0);
             }  
           }
          if(!isNaN(data[i].state)) This.barData[baridx].h[idx]=Math.max(data[i].state,This.barData[baridx].h[idx]??0);
          pervidx=idx;
         }
        latestval=data[i].state;
       }
      for(;pervidx>=0;pervidx--)
       {
        if(!isNaN(latestval)) This.barData[baridx].h[pervidx]=Math.max(latestval,This.barData[baridx].h[pervidx]??0);
       }  
     }
    baridx++;
    if(baridx<This.barData.length)
     {
      setTimeout(TPowerCard._reqHistEntityData,100,This,baridx);
     }
    else
     {
      This._drawBarContent();
      setTimeout(TPowerCard._reqHistEntityData,60000,This,0);
     }
   }
//#################################################################################################
  async _fetchRecent(entityId, start, end, skipInitialState, withAttributes)
   {
    let url='history/period';
    if(start) url+=`/${start.toISOString()}`;
    url+=`?filter_entity_id=${entityId}`;
    if(end) url+=`&end_time=${end.toISOString()}`;
    if(skipInitialState) url+='&skip_initial_state';
    if(!withAttributes)  url+='&minimal_response';
    if(withAttributes)   url+='&significant_changes_only=0';
    //url+=`&no_attributes&minimal_response&significant_changes_only=0`;
    return this._hass.callApi('GET', url);
   }
//#################################################################################################
  _getPos(v,width)
   {
    let pc=this.maxpos/width;
    switch(this.config.scaletype?this.config.scaletype.toLowerCase():"log10")
     {
      case "linear":
       {
        let a=v/pc;
        return Math.min(Math.round(a),width);
       } break;
      case "log10":
       {
        if(v>0)
         {
          let a=Math.log10(v)/pc;
          return Math.min(Math.round(a),width);
         }
        else return 0;
       } break;
     }
   }
//#################################################################################################
  _rgbToHsl(color)
   {
    let hex=color.replace(/^\s*#|\s*$/g,''); // strip the leading # if it's there
    if(hex.length==3) hex=hex.replace(/(.)/g, '$1$1');  // convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
    let r=parseInt(hex.substr(0,2),16)/255,
        g=parseInt(hex.substr(2,2),16)/255,
        b=parseInt(hex.substr(4,2),16)/255;
  
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h,s,l=(max+min)/2;
  
    if(max==min) h=s=0; else
     {
      let d=max-min;
      s=l>0.5?d/(2-max-min):d/(max+min);
      switch(max)
       {
        case r: h=(g-b)/d+(g<b?6:0);break;
        case g: h=(b-r)/d+2;break;
        case b: h=(r-g)/d+4;break;
       }
      h/=6;
     }
    return [h, s, l];
   }
//#################################################################################################
  _hslToRgb(h, s, l)
   {
    let r, g, b;
    if(s==0) r=g=b=l; else
     {
      function hue2rgb(p,q,t)
       {
        if(t<0) t += 1;
        if(t>1) t -= 1;
        if(t<1/6) return p + (q - p) * 6 * t;
        if(t<1/2) return q;
        if(t<2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
       }
  
      let q=l<0.5?l*(1+s):l+s-l*s;
      let p=2*l-q;
      r=hue2rgb(p,q,h+1/3);
      g=hue2rgb(p,q,h);
      b=hue2rgb(p,q,h-1/3);
     }
    //return [r*255,g*255,b*255];
    return `#${Number(Math.round(r*255)).toString(16).padStart(2, '0')}${Number(Math.round(g*255)).toString(16).padStart(2, '0')}${Number(Math.round(b*255)).toString(16).padStart(2, '0')}`
   }
//#################################################################################################
  _drawBarItem(x, y, width, height,entity)
   {
    let bar_x=x+this.metric.chartwidth+this.metric.iconwidth+this.metric.padding*2;
//console.log(">>>>>>>>>>>>>>>>>>>>>>>>>",this.fonts.name,this.metric.nameheight)

    let bar_yoffset=this.metric.nameheight;//Math.trunc(height/2);
    let chart_x=x+this.metric.iconwidth+this.metric.padding;

    // Draw main bar and char frame
    this.ctx.fillStyle=this.colors.card_bg;//bar_bg;
    this.ctx.strokeStyle=this.colors.bar_frame;

    this._roundRect(bar_x,y+bar_yoffset,width-bar_x+.5, height-bar_yoffset+.5,3,true,true);
    this.ctx.fillStyle=this.colors.card_bg;//this.colors.chart_bg
    this._roundRect(chart_x,y,this.metric.chartwidth,height+.5,0,true,true);

    // Text block
    this.ctx.fillStyle=this.colors.name;
    this.ctx.textBaseline="top";//"middle"; 
    this.ctx.font=this.fonts.name;//"14px Roboto, Noto, sans-serif "//
    // Value
    let valstrwidth=0;
    if(Number(entity.d)>0)
     {
      // Form a string with the current value
      let curvalstr=entity.d+" "+entity.m;
      valstrwidth=this.ctx.measureText(curvalstr).width+this.metric.padding;
      this.ctx.textAlign="end"; 
      this.ctx.fillText(curvalstr,width+.5,y+3);
     }
    // Name
    this.ctx.textAlign="start"; 
    this.ctx.fillText(entity.t,bar_x,y+3,(width-bar_x+.5)-valstrwidth);

    // Actual bar data
    this.ctx.fillStyle=entity.bar_fg?entity.bar_fg:this.colors.bar_fg;
    if(entity.d>0) this._roundRect(bar_x+.5,y+bar_yoffset+.5,this._getPos(entity.d,width-bar_x-1),height-bar_yoffset-.5,3,true,true);

    // Draw grid block
    this.ctx.strokeStyle=this.colors.bar_grid;
    // Bar grid
    this.ctx.beginPath();
    let gridstep=this.maxposraw/10;
    for(let s=gridstep;s<this.maxposraw;s+=gridstep)
     {
      let a=this._getPos(s,width-bar_x);
      this.ctx.moveTo(bar_x+a,y+bar_yoffset+1);
      this.ctx.lineTo(bar_x+a,y+height);
     }
    this.ctx.stroke();

    //Draw chart
    if(entity.h&&entity.h.length)
     {
      this.ctx.strokeStyle=this.colors.chart_fg;
      this.ctx.beginPath();
      for(let i=0;i<entity.h.length;i++)
       {
        if(entity.h[i])
         {
          let a=this._getPos(entity.h[i],height-2);

          this.ctx.moveTo((chart_x+this.metric.chartwidth)-i-1,y+height);
          this.ctx.lineTo((chart_x+this.metric.chartwidth)-i-1,(y+height-a));
         }
       }
      this.ctx.stroke();
     }

   }


  _drawBarContent() {

    this._rebuildColorValue();
    this.ctx.fillStyle=this.colors.card_bg;
    this.ctx.fillRect(0,0,this.size_w,this.size_h); 
    this.ctx.lineWidth=1;
    // Draw content
    let y=this.metric.padding;
    for(let e in this.barData) {
      let r_y=Math.round(y);   
      this._drawBarItem(this.metric.padding+.5,r_y+.5,this.size_w-(this.metric.padding+1),Math.round(this.metric.bar_h)-(this.metric.padding+.5),this.barData[e]);
      y+=this.metric.bar_h;
    }

  }


  _rebuildColorValue() {

    let isDarkMode=this._hass.themes.darkMode;
    this.colors={}
    this.colors.card_bg=   this._compStyle.getPropertyValue("--mdc-theme-surface");
    this.colors.bar_frame= this._compStyle.getPropertyValue("--divider-color");
    this.colors.bar_fg=    this._compStyle.getPropertyValue("--mdc-theme-primary");
    this.colors.chart_fg=  this._compStyle.getPropertyValue("--mdc-theme-secondary");
    this.colors.bar_grid=  isDarkMode?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.2)";
    this.colors.iconoff=   this._compStyle.getPropertyValue("--mdc-theme-text-icon-on-background");
    this.colors.iconon=    this._compStyle.getPropertyValue("--mdc-theme-secondary");
    this.colors.name=      this._compStyle.getPropertyValue("--primary-text-color"); 
    let hsl=this._rgbToHsl(this.colors.bar_fg);
    this.colors.bar_bg=    this._hslToRgb(hsl[0],hsl[1],hsl[2]-.35);
    hsl=this._rgbToHsl(this.colors.chart_fg);
    this.colors.chart_bg=  this._hslToRgb(hsl[0],hsl[1],hsl[2]-.35);

  }


  _roundDate(date)
   {
    let coeff=1000*this.GroupBySec;
    return new Date(Math.floor(date.getTime() / coeff) * coeff);
   }
//#################################################################################################
  _roundRect(x, y, width, height, radius, fill, stroke) {
      if(typeof stroke == 'undefined') {
        stroke = true;
      }
      if(typeof radius === 'undefined') {
        radius = 5;
      }
      if(typeof radius === 'number') {
        radius = {tl: radius, tr: radius, br: radius, bl: radius};
      } else {
        let defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
        for(let side in defaultRadius) {radius[side]=radius[side]||defaultRadius[side];}
      }
      this.ctx.beginPath();
      this.ctx.moveTo(x + radius.tl, y);
      this.ctx.lineTo(x + width - radius.tr, y);
      this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
      this.ctx.lineTo(x + width, y + height - radius.br);
      this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
      this.ctx.lineTo(x + radius.bl, y + height);
      this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
      this.ctx.lineTo(x, y + radius.tl);
      this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
      this.ctx.closePath();
      if(fill) {
        this.ctx.fill();
      }
      if(stroke) {
        this.ctx.stroke();
      }
    }
//#################################################################################################
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

customElements.define("tpower-card", TPowerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tpower-card",
  name: "TPOWER CARD",
  preview: true, // Optional - defaults to false
  description: "Bar chart oriented to display power sensors", // Optional
  documentationURL: "https://github.com/trollix/ha-tpower-card"
});
