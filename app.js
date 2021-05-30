const server = require('express');
const express = require('express');
var router = express.Router();
const got = require('got');
const fs = require('fs');
const { response, json } = require('express');
const { allowedNodeEnvironmentFlags } = require('process');
var bodyParser = require('body-parser');
const { name } = require('ejs');
const _ = require("lodash");
const { DH_NOT_SUITABLE_GENERATOR } = require('constants');
const { stringify } = require('querystring');
const { count } = require('console');

const app = server();
const port = 5000;


const BASE_API_URL = "https://<REGION>.api.riotgames.com/lol";
const API_KEY = "RGAPI-e0a9158b-151b-4631-841d-a35452532899";
//checking if the summonerleague response will be empty file (it will be empty if user has no rankings at all)
function isEmptyObject(obj) {
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return false;
      }
    }
    return true;
  }
app.set('views', './');
app.set('styles', './');
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/'));
app.use(express.static(__dirname + '/img/'));
app.use(express.json());
app.use(express.urlencoded({
    extended: true
  }))

app.get('/', (req,res) => {

    res.render('index');
    
})


app.get('/profile/', async (req, res,next) => {
   
    // const username = req.body.profile;
    const username = req.query.profile;

    res.locals.title ="Username - " +  username; 
    

    let response;
    let data;

    try {
        response = await got(`${BASE_API_URL.replace("<REGION>", "eun1")}/summoner/v4/summoners/by-name/${username}?api_key=${API_KEY}`);
        data = JSON.parse(response.body);
        console.log(data);
    } catch (error) {
        res.render('error');
        console.log(error);
    }

    let puuid;
    let gameData_response
    let gameData_data
    try {
        puuid = data.puuid;
        gameData_response = await got(`${BASE_API_URL.replace("<REGION>", "europe")}/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20&api_key=${API_KEY}`)
        gameData_data = JSON.parse(gameData_response.body);
        console.log(gameData_data);
    } catch (error) {
        res.render('error');
        console.log(error);
        
    }
    const winLose = [];
    let wins =  0;
    let loses = 0;
    let ratio = 0;
    try {
        await Promise.all(_.map(gameData_data, async(matchId) => {
            const response = await got(`${BASE_API_URL.replace("<REGION>", "europe")}/match/v5/matches/${matchId}?api_key=${API_KEY}`);
            const responseData = JSON.parse(response.body);
             // d2rNHsZ-C9zxEUEf59sgNVq458rYr7UD_LxmhPZkxGRTEMPcyXOPOCrt0jq128JKAt_Kr7MS6EQz7w
            
             const user = _.find(responseData.info.participants, (user) => {
                return puuid === user.puuid; 
            });

            if (user !== undefined) {
                winLose.push(user.win);
            
            }
        }));
       
        for(let i = 0; i < winLose.length; i++) {
            if(winLose[i]) {
                wins += 1; 
            } else {
                loses +=1;
            }    
        }
        
        let winloseString = [];
        for(let i = winLose.length; i > winLose.length - 5; i--){
            if(winLose[i]){
                winloseString[i] = "W";
            } else {
                winloseString[i] = "L";
            }
        }
       
        ratio = Math.round((wins / winLose.length) * 100); 
        if(isNaN(ratio)){
            ratio = "Not enough data";
        }
        console.log('ratio = ', ratio);
        console.log('winlose', winLose);
        console.log('user winrate = ', ratio);
        data.ratioVar = ratio;

        var filtered = winloseString.filter(function (el) {
            return el != null;
          });

          data.winLose = filtered;
       
    } catch (error) {
        console.log(error);
    }

    let totalMatches;
    let totalMatchesResponse;
    let accountId = data.accountId;
    try {
        const tot = await got(`${BASE_API_URL.replace("<REGION>", "eun1")}/match/v4/matchlists/by-account/${accountId}?api_key=${API_KEY}`);
        totalMatchesResponse = JSON.parse(tot.body);
        totalMatches = totalMatchesResponse.totalGames;
        data.totalMatches = totalMatches;
        
    } catch (error) {
        console.log(error);
    }
    
    let summonerId = data.id;
    let lastPlayedId;

    try {
        //https://eun1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/o_r20Pa44wHij7imFaXzwvjU-FHBkyyep9Zp3gYK7cF7okw?api_key=RGAPI-eb5ffdde-aff7-466f-82c0-66a569eb6fbd
        const lastPlayed = await got(`${BASE_API_URL.replace("<REGION>", "eun1")}/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}?api_key=${API_KEY}`);
        const lastPlayedResponse = JSON.parse(lastPlayed.body);
        function getMin(arr, prop) {
            var min;
            for (var i=0 ; i < arr.length ; i++) {
                if (min == null || parseInt(arr[i][prop]) > parseInt(min[prop]))
                    min = arr[i];
            }
            return min;
        }
        var minPlayTime = getMin(lastPlayedResponse, "lastPlayTime");
        let championId = minPlayTime.championId;
        lastPlayedId = minPlayTime.championId;
        // const lastIndex = lastPlayedResponse.length;
        // // const lastIndex = 0;
        // lastPlayedId = lastPlayedResponse[lastIndex - 1].championId;
        const lastChampBg = `https://lolg-cdn.porofessor.gg/img/banners/champion-banners/${championId}.jpg`;
        data.lastChampBg = lastChampBg;
        data.lastChamp = championId;
        console.log("last played champ ", championId);

        
    } catch (error) {
        console.log(error);
    }
    

    let lastChampName;
    const lastChampId = data.lastChamp;
    const championList = await got('http://ddragon.leagueoflegends.com/cdn/9.3.1/data/en_US/champion.json');
    const championListJSON = JSON.parse(championList.body);
    const championListData = championListJSON.data;
    for (const i in championListData) {
        if(championListData[i].key == lastPlayedId){
            console.log('found the champ', championListData[i].id);
            lastChampName = championListData[i].id;
            
        }
    }
    data.lastChampionPlayed = lastChampName;

    
   
    const champMastery = await got(`${BASE_API_URL.replace("<REGION>", "eun1")}/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}?api_key=${API_KEY}`);
    const champMasteryJs = JSON.parse(champMastery.body);
    let champMast;
    let champPoints;
    let playTime;
    let chest;
    for(let i in champMasteryJs){
        // console.log(champMasteryJs);
        if(champMasteryJs[i].championId === lastPlayedId) {
            console.log(`champ mastery for ${data.lastChamp} is ${champMasteryJs[i].championLevel}`);
            champMast = champMasteryJs[i].championLevel;
            champPoints = champMasteryJs[i].championPoints;
            playTime = champMasteryJs[i].lastPlayTime;
            chest = champMasteryJs[i].chestGranted;
        }
    }

    data.ChestGranted = chest;
    data.LastChampMast = champMast;
    data.ChampPoints = champPoints;
    //playtime conversion into minutes
    let playTimemin = playTime;
    function msToTime(duration) {
        var milliseconds = Math.floor((duration % 1000) / 100),
          seconds = Math.floor((duration / 1000) % 60),
          minutes = Math.floor((duration / (1000 * 60)) % 60),
          hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
      
        hours = (hours < 10) ? "0" + hours : hours;
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;
      
        return hours + ":" + minutes + ":" + seconds;
      }

    
       let summonerLeague;
       summonerId = data.id;
       const summonerLeaugeResponse = await got(`${BASE_API_URL.replace("<REGION>", "eun1")}/league/v4/entries/by-summoner/${summonerId}?api_key=${API_KEY}`);
       summonerLeague = JSON.parse(summonerLeaugeResponse.body);
       console.log('summoner league ', summonerLeague);
       if(isEmptyObject(summonerLeague)){
            data.rankedSoloTier = 'NO_RANK';
            data.rankedSoloRank = 'NO_RANK';
            data.rankedFlexTier ='NO_RANK';
            data.rankedFlexRank = 'NO_RANK';
       }else {
           
           data.rankedSoloTier = summonerLeague[0].tier;
           data.rankedSoloRank = summonerLeague[0].rank;
           data.rankedFlexTier = summonerLeague[1].tier;
           data.rankedFlexRank = summonerLeague[1].rank;

           
          
       }
    



    data.playTime = msToTime(playTime);
    const  name = data.name;
    const summonerLevel = data.summonerLevel;
    const suummonerPicId = data.profileIconId;
    data.avatarLink = `https://opgg-static.akamaized.net/images/profile_icons/profileIcon${suummonerPicId}.jpg?image=q_auto:best&v=1518361200`;
    
    const ratioProfile = data.ratio;

    res.render('profile', data);
    const ratioVar = 'ratio';
    // data.ratioVar = ratio;
    fs.writeFileSync("./download.json", JSON.stringify(data, null, 4),"utf8", {flag:"a"});

   

  })
   app.get("/download", (req,res) => {
     // fs.writeFileSync("./download.json", JSON.stringify(req.body, null, 4),"utf8");
     const file = "./download.json";
     res.download('./', 'download.json');
     console.log(file);
     res.send('ok');
   });
 app.listen(port, () => {
    console.log('App is listening on port: 5000');
 })



