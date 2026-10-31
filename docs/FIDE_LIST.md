# FIDE official monthly list (verified 2026-10-31)

Source: `https://ratings.fide.com/download/players_list_xml.zip` (one request, UA `ChessAtlasBot/1.0 (India chess directory)`).
Size 50.9 MB zip; one member `players_list_xml_foa.xml`, 862 MB unpacked, about 212.6k IND records.

The single "foa" file carries standard, rapid and blitz ratings together. No separate rapid/blitz download is needed.

Structure: `<playerslist><player>...</player>...</playerslist>`, flat child elements per player:
`fideid, name, country, sex, title, w_title, o_title, foa_title, rating, games, k, rapid_rating, rapid_games, rapid_k, blitz_rating, blitz_games, blitz_k, birthday, flag`

- `name` is "Surname, Given" (some start with ", , "); XML entities are escaped.
- `country` is the 3-letter federation code (we keep `IND`).
- Rating 0 means unrated; we store NULL. `flag` contains `i` when inactive (`w` = women, `wi` = both).
- `birthday` is present in the file but is never read or stored.
- The file has no period field; the caller supplies `YYYY-MM`.

Ingest: `backend/src/fide/ingest.ts` (streams `unzip -p`, no extra npm dependencies).
