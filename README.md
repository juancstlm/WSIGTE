# WSIGTE (Where Should I Go To Eat?)
A website that will recommend places to eat based on your location. Built using Node js and Apple's new [MapKit JS](https://developer.apple.com/documentation/mapkitjs) framework. 
Automatically signs a JWT using [jsonwebtoken](https://github.com/auth0/node-jsonwebtoke).

Created as a tribute to [WTFSIGTE.COM](https://wtfsigte.com/)

## Requirements
* node js

To obtain the following visit [Apple's Site](https://developer.apple.com/documentation/mapkitjs)
* Private key for Apple Maps
* Apple Development team ID
* MapKit Key ID 

## Usage
Clone this repo and create a `.env` file similar to `.env_sample` and then run the following commands.
1. `npm install`
2. `npm start`

To view the site visit `http://localhost:3000/`

## Demo
If you just want to see the site in action check it out below.

[https://wsigte.herokuapp.com/](https://wsigte.herokuapp.com/)

## Screenshot

![WSIGTE in browser](https://raw.githubusercontent.com/juancstlm/WSIGTE/master/wsigte-2.png?token=ACFZWMCYZ73GMK2WBZJQZOC5BBIGG)


# TODO 
* Allow user to enter their own location.
* Button to pick another result.
* Loading and UI improvements.
