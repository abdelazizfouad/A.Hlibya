import json
import re

# We will populate the complete catalog from the user's spreadsheet
lines_data = """A0004212112,طنابير امامي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,2,0,0,1
A0004212112 GSP,طنابير امامي GSP,Brake Disk,42 BRAKES & HYDRAULICS,GSP,AFTERMARKET,1,0,0,2
A0004212212,طنابير امامي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,2,0,0,1
A0004212412,طنابير امامي,FRONT BRAKE DISK,42 BRAKES & HYDRAULICS,PSB,AFTERMARKET,1,0,0,1
A0004212512,طنبورة فرامل أمامية,Front Brake,01 ENGINE & TIMING,BREMO,GENUINE_OEM,4,0,0,1
A0004212712,طنابير امامي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,1,0,0,1
A0004230512,طنابير خلفي,REAR BRAKE DISK,42 BRAKES & HYDRAULICS,Mercedes-Benz Genuine Parts,ORIGINAL,1,0,0,1
A0004230712,طنابير خلفي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,2,0,0,1
A0004231212,طنابير خلفي,(Rear Brake,42 BRAKES & HYDRAULICS,TRUCKTEK,AFTERMARKET,1,0,0,1
A0004231312,طنابير خلفي,REAR BRAKE DISK,42 BRAKES & HYDRAULICS,PSB,AFTERMARKET,1,0,0,1
A0004231812,طنابير خلفي,REAR BRAKE DISK,42 BRAKES & HYDRAULICS,Mercedes-Benz Genuine Parts,ORIGINAL,1,0,0,1
A1694210112,قرص فرامل أمامي,Front Brake Disc,42 BRAKES & HYDRAULICS,ROCK BERG,AFTERMARKET,1,0,0,1
A1694210112,طنابير امامي,Brake Discs,42 BRAKES & HYDRAULICS,china,AFTERMARKET,5,0,0,2
A2034210312,قرص فرامل أمامي,Front Brake Disc,42 BRAKES & HYDRAULICS,ROCK BERG,AFTERMARKET,3,0,0,1
A2034210512,طنابير أمامي,Brake Discs,42 BRAKES & HYDRAULICS,GSP,AFTERMARKET,2,0,0,1
A2044210012,طنابير امامي,FRONT BRAKE DISK,42 BRAKES & HYDRAULICS,Mercedes-Benz Genuine Parts,GENUINE_OEM,2,0,0,1
A2044210712,طنابير أمامي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,2,0,0,1
A2044210812,قرص فرامل أمامي,Front Ventilated Brake,42 BRAKES & HYDRAULICS,ROCK BERG,AFTERMARKET,7,0,0,1
A2044230512,قرص فرامل خلفي,Rear Brake Rotor,42 BRAKES & HYDRAULICS,ROCK BERG,AFTERMARKET,2,0,0,1
A2044231512,طنابير خلفي,Rear Right Solid Brake,42 BRAKES & HYDRAULICS,ROCK BERG,AFTERMARKET,4,0,0,1
A205,مقص امامي حرف U شمال,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,35,0,0,1
A20505,مقص امامي المونوم L,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,54,0,0,1
A20506,مقص أمامي المونيوم R,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,46,0,0,1
A20513,مقص أمامي حديد L,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,34,0,0,1
A20519,مقص امامي حديد L,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,8,0,0,1
A2060100,مقص امامي المونيوم,Front Upper Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,4,0,0,1
A2060300,مقص امامي المونيوم,Front Left Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,2,0,0,1
A2063331000,مقص امامي المونيوم يمين,Front Right Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,1,0,0,1
A2063331100,مقص امامي المونيوم شمال,Front Left Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,2,0,0,1
A2063331200,مقص المونيوم يمين,Front Right Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,2,0,0,1
A2063900,مقص امامي المونيوم شمال,Front Left Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,4,0,0,1
A2064211200,طنابير امامي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,1,0,0,1
A2064211400,طنابير امامي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,1,0,0,1
A2064230000,طنابير خلفي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,GENUINE_OEM,1,0,0,1
A2064230900,طنابير خلفي,brake disc,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,1,0,0,1
A2069006219,كنترول باب خلفي شمال,Left Rear Door Control Unit,54 ELECTRICAL & SENSORS,Mercedes-Benz Genuine Parts,GENUINE_OEM,4,0,0,1
A2114210712,قرص فرامل أمامي,Front Brake Disc,42 BRAKES & HYDRAULICS,ROCK BERG,AFTERMARKET,5,0,0,1
A2114211012,طنابير أمامي,Brake Discs,42 BRAKES & HYDRAULICS,GSP,AFTERMARKET,2,0,0,1
A2114230712,طنابير خلفي,Rear brake,42 BRAKES & HYDRAULICS,TRAUCKTEK,AFTERMARKET,3,0,0,1
A2140400,مقص امامي المونيوم يمين,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,2,0,0,1
A2143330700,مقص امامي المونيوم شمال,Front Left Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,3,0,0,1
A2143330800,مقص امامي المونيوم يمين,Front Right Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,5,0,0,1
A2143330900,مقص امامي المونيوم شمال,Front Left Control Arm,01 ENGINE & TIMING,Mercedes-Benz Genuine Parts,GENUINE_OEM,1,0,0,1
A2214230412,طنابير خلفي,REAR BRAKE DISK,42 BRAKES & HYDRAULICS,Mercedes-Benz Genuine Parts,AFTERMARKET,1,0,0,1
A2214230712,قرص فرامل خلفي,Rear Brake,42 BRAKES & HYDRAULICS,ROCK BREG,AFTERMARKET,1,0,0,1
A22242115100,طنابير أمامي,Brake Discs,42 BRAKES & HYDRAULICS,CHINESE,AFTERMARKET,4,0,0,1
A2224231500,طنابير خلفي,RARE BRAKE DISK,42 BRAKES & HYDRAULICS,Mercedes-Benz Genuine Parts,ORIGINAL,1,0,0,1
A2233335900,مقص المونيوم شمال,Front Left Tension Strut,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,8,0,0,1
A2233336000,مقص امامي المونيوم يمين,Front Right Tension Strut,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,13,0,0,1
A2235400,مقص امامي المونيوم يمين,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,7,0,0,1
A2235500,مقص المونيوم شمال,: Front Left Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,3,0,0,1
A2464210012,طنابير فرامل أمامية,Front Brake,42 BRAKES & HYDRAULICS,BREMBO,GENUINE_OEM,6,0,0,1
A2464210112,طنابير امامي,Brake Discs,42 BRAKES & HYDRAULICS,GSP,AFTERMARKET,5,0,0,1
A2464212512,طنابير امامي,brake disc,42 BRAKES & HYDRAULICS,AYD,AFTERMARKET,1,0,0,1
A2464230012,طنابير فرامل خلفية,Rear Brake,42 BRAKES & HYDRAULICS,TRUCKTEK,AFTERMARKET,2,0,0,1
A2464230112,طنابير خلفي,REAR BRAKE DISK,42 BRAKES & HYDRAULICS,PSB,AFTERMARKET,2,0,0,1
A2474210312,طنابير امامي,FRONT BRAKE DISK,42 BRAKES & HYDRAULICS,AYD,AFTERMARKET,1,0,0,1
A2474210412,طنابير امامي,FRONT BRAKE DISK,42 BRAKES & HYDRAULICS,AYD,AFTERMARKET,5,0,0,1
A2474230112,طنابير خلفي,REAR BRAKE DISC,42 BRAKES & HYDRAULICS,Mercedes-Benz Genuine Parts,ORIGINAL,2,0,0,1
A2530100,مقص أمامي المونيوم L,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,46,0,0,1
A2530200,مقص أمامي المونيوم R,Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,51,0,0,1
A2540100,مقص أمامي حديد,Front Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,16,0,0,1
A2543330300,مقص أمامي المونيوم شمال,Front Lower Left Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,3,0,0,1
A2543330400,مقص أمامي المونيوم يمين,Front Lower Right Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,7,0,0,1
A2649060404,مرش,Starter MotoR,01 ENGINE & TIMING,Mercedes-Benz Genuine Parts,GENUINE_OEM,1,0,0,1
A2970300,مقص حديد خلفي شمال,Rear Lower Suspension Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,1,0,0,1
A2970400,مقص تعليق  حديد خلفي يمين,Rear Right Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,1,0,0,1
A2973330700,مقص أمامي المونيوم L,Front Left Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,9,0,0,1
A2973330800,مقص امامي المونيوم R,Front Left Lower Control Arm,32 SUSPENSION & SPRINGS,Mercedes-Benz Genuine Parts,GENUINE_OEM,7,0,0,1
A4474210012,طنابير امامي,BRAKE DISK FRONT,42 BRAKES & HYDRAULICS,AYD,AFTERMARKET,2,0,0,1"""

with open('scripts/parts_raw_chunk1.csv', 'w', encoding='utf-8') as f:
    f.write(lines_data)

print("Chunk 1 written successfully.")
