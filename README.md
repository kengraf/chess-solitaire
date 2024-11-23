# chess-solitaire
### Motivation for this repo.
1. Give me something fun to do while deskbound after surgery post op.
2. Document the process for creating a static website for my cloud class at UNH.
3. Take the rust off my web development skills.
4. Do something creative to address my boredom post-op.

### What this repo does
An online chess game based on the long running ~Chess solitaire~ articles in Chess Life by ~Bruce Pandolfini~. Fundamentally this is a make the next move type of game.  
Bruce is a well-regarded chess coach. After an inital opening you play one side with each move being scored, I like the commentary and rationale that Bruce provides on why the moves were actually made.
I will add more games as I go back through previous issues and as time allows.

### Creating a static website that auto deploys via AWS
1. Create a repo (duh).  My dev-ops process is very simple. Create a local clone.  Host locally with ```python -m http.server```.  Push updates on a nightly basis.
2. Create a public AWS bucket with ~static website hosting~ enabled.  This will create an unsecured site at URL like: ```http://<bucket-name>.s3-website.us-east-2.amazonaws.com```.
3. Create a CloudFront deployment
