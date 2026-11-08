https://fiorella-francione.github.io/geog464-lab5/site/
1) Problem:
Montreal's 2030 Climate Plan includes a strategy to convert open parking lots into green spaces in an effort to plant 500 000 new trees.
2) The audience:
borough planners, environmental advisors
3) Core action
Identify and filter through open parking spaces by borough, click any point to view its address and hourly rate.
Serves as a first step in identifying candidates for conversion into green spaces. 
4) Boundary
Set to the boroughs included in the parking lots data (ville de Montreal municipality)
5) Data
Parking lots data receipt
Title: Stationnements municipaux tarifés, sur rue et hors rue
Publisher: Agence de mobilité durable
Link: https://www.agencemobilitedurable.ca/fr/informations/donnees-ouvertes.html
Licence: Creative Commons CC-BY 4.0
Date accessed: 2026-09-25
Count before: 19 641 rows
Count after: 1 678 rows

Borough boundaries data receipt
Title: Administrative boundaries of the agglomeration of Montreal (NAD83/MTM zone 8)
Publisher: Government and Municipalities of Québec, Creative Commons CC-BY 4.0, accessed 2026-10-08
Link: https://open.canada.ca/data/en/dataset/9797a946-9da8-41ec-8815-f6b276dec7e9/resource/94a9f002-3c46-4a7f-99cc-db0a0e01f7bc
Licence: Creative Commons CC-BY 4.0
Date accessed: 2026-10-08
no rows changed, only used the columns "NOM" and "geometry". 

Urban heat island data receipt
Title: Îlots de chaleur 2025 (images satellite)
Publisher: Ville de Montreal
Link: https://donnees.montreal.ca/fr/dataset/dbdfbdba-0725-470d-a23e-da69dbedc4e6/resource/e5ef5957-3088-4e88-baab-53f2aa5cd866/download/icu_20250821.zip
Licence: Attribution (CC-BY 4.0)
Date accessed: 2026-10-23

## AI disclosure: Blue lane
I used the format from Lab 3 to load in my data, export the cleaned rows into a GeoJSON and the check cell. To help with the section on using geopandas to join my parking lot data with their respective boroughs, I used the built-in Copilot chat with the Auto "Balance" model. The method I used for asking the AI was first define my dataset (boroughs.geojson) and join it with df_h (dataframe with only off-street parking rows). I also specified to the AI not to make changes to my notebook and to also include comments to each line of code so I could understand what each line did. It suggested I load the geopandas extension first, create points from my df_h and check that both datasets were in the same coordinate system. Then, it wrote the line for the join but it also wrote a line to save this join into a new GeoJSON. I removed this line because I wanted to save it to the same GeoJSON file I had created earlier. To verify the join, I counted the number of points that did not match a borough and it came up as 0. As for the presentation and behavior of the website, I asked AI to help load in a font family I found online. It also suggested a few details to make the website stand out inlcuding adding a border to the map and changing the background color, which I accepted once I knew how it worked. Some changes had to be made throughout app.js, html and style.css for the legend to show up properly. I tweaked the dimensions of the map size, text, legend to my own liking.

After the demo:
At my demo, I was not sure how I would clip my parking lot points to my urban heat island data layer.
Today I will filter my urban heat island layer for my concerned boroughs, create a grid for them and overlay my parking
points over it.

Darker square have a higher surface temperature (range of 29.7-35.1 celsius).

## A3 feature: 
For A3 I will bring in my second dataset (urban heat island effect) and make a ranking score for each clustered parking lot.
It has depth because it computes the lot's average surface temperature into a score, then ranks the lots within a selected borough.
I will know it works when I can type a borough, ignoring case and accents, click on the ranked parking lot and the map zooms into the correct area.
My edge case is an inputted borough name that does not match my data shows a message that it was not found and asks to search for another borough.

Test 1. I type a borough like "Outremont" and click the rank 1 lot.
 Expected: Zooms into Outremont, opens the rank-1 popup.
 -> Passed
Test 2. I type a different borough, "Verdun" and click its rank-1 lot.
 Expected: Zooms into Verdun, shows popup for the new rank-1 spot.
 -> Passed
Test 3. I type "xyz".
 Expected: "Borough not found, try again" message.
 -> Passed

 ## Pre-flight report (Lab 7)
| Check | Result | What I did |
| 1. Cold start | failed, since I made changes to my data and created parking_cluster.geojson, the github page was not loading the data  | I used git commit to add the geojson file and the page loads properly|
| 2. Read every label | pass | nothing shows up as undefined |
| 3. Ask twice | pass |  the first response goes away after searching a second borough |
| 4. The edge | pass | typing "xyz" to find a borough shows a message "Borough not found, try again" |
| 5. The data does not come | pass | when the heat grid or parking_priority.geojson is blocked, this message shows up: "Could not load the heat grid or priority-ranked parking locations. Open the console (F12) for details." |
| 6. On a phone (size view and my phone) | pass | the page loads properly on a phone, the search feature can still be used |
| 7. Mouse in my pocket | pass | all points and the search box work as a button |
| 8. Accessibility audit | pass | accessibility score is 100 |