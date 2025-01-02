# chess-solitaire 
### Motivation for this repo.
1. Give me something fun to do while deskbound due to eye surgery post op.
2. Document the process for creating a static website for my cloud class at UNH.
3. Take the rust off my web development skills.
4. Do something creative to address my post-op boredom.

### What this repo does
An online chess game based on the long running _Chess solitaire_ articles in _Chess Life by Bruce Pandolfini_. Fundamentally this is a make the next move type of game.  
Bruce is a well-regarded chess coach. After an inital opening you play one side with each move being scored, I like the commentary and rationale that Bruce provides on why the moves were actually made.
I will add more games as I go back through previous issues and as time allows.

### Creating a static website that auto deploys via AWS
1. Create a repo (duh).  My dev-ops process is very simple: A) Create a local clone. B) Host locally with ```python -m http.server```.  C) Push updates on a nightly basis, using a .gitignore to prevent pushing my dev artifacts.
2. Create a public AWS bucket with _static website hosting_ enabled.  Create a bucket policy that allows GETs.  This will create an unsecured site at URL like: ```http://<bucket-name>.s3-website.us-east-2.amazonaws.com```.  First 5GB and 200K requests are free.  
2a. Optional: Allow secure connections. Create a regional CloudFront distribution using an AWS based cert. I use an alternate domain name (CNAME) based on the _kengraf.com_ domain I own. First 1TB and 10M requests are free.  
3. Create a AWS workflow to push your github repo change automatically to S3.  You can use the workflow in this repo as an example.  In your repo settings, create two action secrets (AWS_ACCESS_KEY and AWS_SECRET_ACCESS_KEY) using your AWS credentials.  
4. Enjoy

### How the game works
TBD.
http://localhost:8000?mode=test&game=all_tests.json
