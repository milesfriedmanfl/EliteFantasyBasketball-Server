# Elite Fantasy Basketball - Server

## I. About

Meant to be used in conjunction with an AWS account, this project bundle of setup scripts to create, deploy, and manage a fantasy-basketball backend server, which uses discord as a front end to accept and respond to commands from users to query and display data pertaining to my yahoo fantasy basketball league. This not something I plan to monetize, or use anywhere but in my own fantasy league, therefore it's likely that all future commands, (like the current ones) will only be compatible with yahoo's fantasy basketball platform. 

The current MVP is set up to automate the deployment and destruction of AWS network resources and a server that can respond to two commands: ```/live-standings``` and ```/category-record-holders```. More are planned in the future. Additional details on what these do and how the server works can be found in subsequent sections. (section III and onwards)

Here is an example of what this looks like in as an end user in my fantasy basketball discord:
![Image of UI Screen Capture](https://github.com/milesfriedmanfl/EliteFantasyBasketball-Server/blob/master/src/assets/images/docs/live-standings-example.png)

## II. Project Directory Overview + Setup

The project is broken down into setup and src directories. The ```/setup``` directory contains Terraform configs, dockerfiles, and bash scripts that will automate the process of generating certificates (necessary so that your machine can remote-access the server within the network) and creating network resources using generated certs as input. The ```/src``` directory contains the code for the server. More info on that in the dedicated section on server architecture.

### Prerequisites:

1. **A Discord Developer Account, Server, and Application** - As mentioned previously, this server is meant to provide a backend for responding to discord commands, therefore you'll need a server. You'll also need to enable developer mode within your discord account, and create an "application". Setup for that is quick, but I will not go into how to do that here. The discord developer docs provide an easy guide for doing so: https://discord.com/developers/docs/


2. **An AWS Account and AWS Credentials** - I'm using AWS, therefore the Terraform files that provision network resources do so within AWS. You'll need an AWS account with which you'll be able to deploy the network resources to. You'll also need to download AWS credentials from the AWS management console locally, so that they can be passed into the setup scripts and used for provisioning under your account. This can be done from the AWS Management Console.

<p style="margin-left: 4ch; display: block;">
    <strong>[Note:]</strong> no need to worry about the CLI or any other dependencies here such as terraform on your workstation, all of that is taken care of for you in the dockerfiles and abstracted away.
</p>

### Setup:

1. **(Optional) Set Default Config Variables:** 

    In the generate-certificates.sh file edit the ```DEFAULT_HOST_AWS_CONFIG_PATH``` to the path to your stored AWS credentials, the ```DEFAULT_AWS_REGION``` to the region of your choice, and ```DEFAULT_HOST_CERTS_PATH``` to an output directory of your choice. Alternatively these can be done through a flag at runtime. In the create-or-destroy-network-resources.sh file update the ```DEFAULT_HOST_AWS_CONFIG_PATH``` to the path to your stored AWS credentials, and ```DEFAULT_HOST_CERTIFICATES_PATH``` default variable if you would like to match the ```DEFAULT_HOST_CERTS_PATH``` default used in the other script. Or you may simply pass these through flags at runtime.


1. **Generate Certificates:**
    
    Run the ```generate-certificates.sh``` file with the appropriate flags to generate certificates. By default, (with no flags passed) it will place generated certificates in a ```/certificates``` folder under the same ```/generate-certificates``` directory where the .sh file is located. This is the assumed default behaviour by both scripts, so it does not need to be changed unless you'd like it in a particular spot on your machine. The other variable denoting the AWS_REGION may be changed via flag. The script may be run with 0, 1, 2, or all flags. 

<p style="margin-left: 4ch; display: block;">
Example below: <br>
<code>./generate-certificates.sh -r desired-region -c /desired/output/path/to/certificates -a /path/to/aws-credentials</code>
</p>


2. **Create Network Resources:**

    Run the ```create-or-destroy-network-resources.sh``` to deploy network resources to AWS using your AWS credentials. The script may be run with 0, 1, 2, or all flags. The ```--create``` flag is passed as part of setup to provision the resources, but the ```--delete``` flag may be run instead to destory all network resources and the server.  

<p style="margin-left: 4ch; display: block;">
<strong>[IMPORTANT:]</strong> A terraform.tfstate file is outputted at the conclusion of the <code>--create</code> command in the project's <code>/terraform</code> directory. DO NOT EDIT OR DELETE THIS FILE. This is what the <code>--delete</code> command uses to know what network resources to destroy at the end. In the absence of this file, you would be forced to manually remove/destroy network resources from within AWS.
</p>

<p style="margin-left: 4ch; display: block;">
Here is an example of how to run with some flags passed: <br><code>./create-or-destroy-network-resources.sh -a /path/to/your/aws/credentials -c /path/to/your/certificates --create</code>
</p>

3. **Download Client VPN Config Files:**

    As part of the terraform setup, a client vpn endpoint is deployed so that a manager can remote into the machine that will run the server for setup and management purposes. In order for a remote machine (your workstation) to able to do so, it needs an .ovpn file which can be downloaded from the AWS Management Console. 


4. **Setup The Remote Machine and Deploy the Server Instance:**

    **[Note:]** This step is messy and involved because it hasn't been automated yet. In the future this step will be automated via docker script to make easier the process of deployment and abstract this process away, but for now these are basically notes for myself, so I don't need to remember them later. There are multiple steps involved in setting up the remote server and deploying. Some require dependencies such as sftp. This must be done once after provisioning the resources for the first time using --create as specified above.

<p style="margin-left: 4ch; display: block;">  
    a) From within the project, create a zip of server directory:
    <br><code>sudo zip -r server.zip src/</code>
</p>
<p style="margin-left: 4ch; display: block;">  
    b) Connect to client vpn:
    <br><code>sudo openvpn --config /path/to/downloaded/client-vpn-config.ovpn --cert /path/to/generated/certificates/fb-vpn-client.crt --key /path/to/generated/certificates/fb-vpn-client.key</code>
</p>
<p style="margin-left: 4ch; display: block;"> 
    c) SFTP through bastion host public ec2 into private ec2 instance. The variables denoted by {} can be found in the outputted terraform.tfstate file that is produced as a result of running <code>--create</code> in step 2.
    <br><code>sftp -o ProxyJump={ec2-2a-public-username}@{ip-of-public-ec2} {ec2-2a-private-username}@{ip-of-private-ec2}</code>
</p>
<p style="margin-left: 4ch; display: block;"> 
    d) Copy server.zip to private ec2
    <br><code>put -r /path-to/server.zip</code>
</p>
<p style="margin-left: 4ch; display: block;">
    e) SSH through bastion host public ec2 into private ec2 instance. The variables denoted by {} can be found in the outputted terraform.tfstate file that is produced as a result of running --create in step 2.
    <br><code>ssh -J {ec2-2a-public-username}@{bastion-public-ip} {ec2-2a-private-username}@{private-instance-private-ip}</code>
</p>
<p style="margin-left: 4ch; display: block;"> 
    f) Unzip server.zip
    <br><code>unzip server.zip</code>
</p>
<p style="margin-left: 4ch; display: block;"> 
    g) Setup remote server machine dependencies for running the elite-fantasy-basketball server. The following commands should be able to be copy-pasted as is:
    <br><code>
    # Install NVM
    sudo curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash <br>
    <br>
    # Source NVM to make it available in this script
    source ~/.nvm/nvm.sh <br>
    <br>
    # Install latest stable version of node
    nvm install 18.18.0 <br>
    <br>
    # Install NPM
    sudo apt-get install npm -y
    </code>
</p>
<p style="margin-left: 4ch; display: block;"> 
    h) Delete non-deployment files (from within the unzipped project directory)
    <br><code>
    rm -r node_modules
    rm discord-command-handler/deploy-commands.*
    rm discord-command-handler/commands/test.ts
    rm -r dist/
    </code>
</p>
<p style="margin-left: 4ch; display: block;">
    i) Install puppeteer OS dependencies for the remote machine
    <br><code>
    sudo apt-get update
    sudo apt-get install ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
    </code>
</p>
<p style="margin-left: 4ch; display: block;">
    j) Install project packages
    <br><code>
    npm install
    npm audit fix
    </code>
</p>
<p style="margin-left: 4ch; display: block;">
    k) Start server
    <br><code>
    npm run start-server
    </code>
</p>

## I. Architecture

### Network Architecture

![Image of Network Architecture Diagram](https://github.com/milesfriedmanfl/EliteFantasyBasketball-Server/blob/master/src/assets/images/docs/elite-fantasy-basketball-network.jpeg)

Above is a diagram depicting the resources that will be deployed as a result of the script running that provisions resources. This may seem like overkill as far as setup goes, but I intend to build this out over time with other commands that may contain sensitive data, and therefore I wanted the network to be security focused. 

To touch on some parts broadly: the API Gateway currently exposes a single endpoint /league-commands which responds to user output. This is required because discord applications only allow a single endpoint to direct commands to, so this acts as a front-controller, where all user requests are delivered through that endpoint to the server, which then parses out metadata to process and handle commands. The server is deployed to the private EC2 instance in the private subnet, so that the only things that can directly access the server are requests delivered through the API pipeline and responses from requests it makes to the external apis or the dynamo db database. The public EC2 instance and associated subnet is used as a bastion host to for managers to ssh into the server from their remote VPN and the client VPN endpoint, and as a way for the server to have access to the internet for external APIs such as the yahoo fantasy basketball api currently used for both existing commands. (other APIs may be used in the future)

### Server Architecture

#### Basic Server Function and Responding To Slash Commands
The server is built on the Nest.js framework, utilizing a single app controller due to discords application requirements discussed above. It only exposes two endpoints, a ```GET``` for health checks from AWS, and a ```POST``` for handling slash commands from discord users. The ```/live-standings``` endpoint funnels request metadata through the ```DiscordCommandHandlerService```, which parses the data and then references command files from the adjacent ```/commands``` directory for handling.

A brief note on the way slash commands work in discord applications: Discord expects a near immediate response to slash commands. The current commands both require async actions taking an unpredictable, but larger-than-immediate amount of time to process. In order to handle this requirement, those async actions are offloaded to the ```DeferredResponseHandler``` service, and a response is sent back to the initial request to show a loading state. While that happens, the ```DeferredResponseHandler``` directs command requests to one of multiple ```CommandHandler``` services for processing, which perform async actions and finally use a webhook to update the loading state to the final expected result.

Both current commands ```/live-standings``` and ```/category-record-holders``` depend on data retrieved from the yahoo fantasy sports API. In order to access this data, the requester must be authorized through oauth. The ```YahooOauthService``` fetches credentials from an AWS dynamodb table, and if they're expired, refreshes the credentials and edits the db table accordingly. The ```YahooFantasySportsApiService``` makes requests to the yahoo api for certain league data. The endpoints provided by Yahoo are provided in extremely verbose XML format, and so significant effort goes into crawling through this data (hence ```YahooFantasySportsDataCrawler```) and then performing certain calculations that differ based on the command executed. 

#### Fantasy Basketball Rules and Current Command Descriptions
My fantasy basketball league is head-to-head categories. Each week managers face off head to head and compete in 9 different categories, (points/assists/rebounds/threes/steals/blocks/turnovers) and in each category the manager's team who performed better earns a win. So every week there are up to 9 wins/losses/draws up for grabs. Standings are calculated based on a win-percentage formula that factors in wins, losses, and draws between managers. 

The ```/live-standings``` command looks at the current scoreboard at any point during the week and tells you what the standings would look like if the week were to end today. It's frequently used on saturdays/sundays especially close to playoff time by managers competing for a final spot wishing to know where they stand and how many games back they'll be based on their current performance during the week. The red line denotes the cutoff between teams that would make playoffs (top 6) vs teams that wouldn't. (bottom 6)

![Image of UI Screen Capture](https://github.com/milesfriedmanfl/EliteFantasyBasketball-Server/blob/master/src/assets/images/docs/live-standings-example.png)

The ```/category-record-holders``` command is used to show which manager holds the season high in a week for each category. For example, it might say that in week 3 the manager's team scored X assists, which is higher than any other week. Last season we rewarded money for the season record holder for each category, and we likely will continue this trend next year.

#### Axillary Server Code Functions

Going back to the server there are two additional modules worth mentioning:

One is the ```DeployCommands``` module. Discord applications require registering of commands with their external api, so that within the server the bot knows what commands can be run and what metadata to send to the backend. In the ```package.json``` there is an npm script command ```deploy-commands``` which uses the ```deploy-commands.js``` file to examine commands in the ```discord-command-handler/commands``` folder and inform the discord application server of their existence. This must be done once, external to the normal operations of the running server, whenever a new command is created, in order to register it. 

The other is the Logger module, made up of files located in the ```src/utils/logger``` directory. The ```Logger.ts``` file is a singleton Winston logger, which uses node.js fs to output formatted log messages to a log file in the ```src/logs``` directory. The ```LoggerDelegate.ts``` file defines a ```LoggerDelegate```, which creates a named log in each server file, that pipes logged messages, the file name, and other context to the log output specified by the instantiated Winston logger. Each time the server is run it clears the log and begins writing again to the same file.