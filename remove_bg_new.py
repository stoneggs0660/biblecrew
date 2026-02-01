
import sys
import os
from PIL import Image

def remove_background(input_path, output_path):
    try:
        print(f"Processing: {input_path}")
        img = Image.open(input_path)
        img = img.convert("RGBA")
        datas = img.getdata()

        newData = []
        # Gemini generated images often have white backgrounds.
        # We'll use a threshold for "white".
        
        for item in datas:
            r, g, b, a = item
            
            # Simple white detection
            # If R, G, B are all very high, it's white or near white.
            if r > 240 and g > 240 and b > 240:
                newData.append((255, 255, 255, 0)) # Transparent
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Saved transparent image to: {output_path}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Target the specific new file
    folder = "public/stamps"
    filename = "Gemini_Generated_Image_pequ65pequ65pequ.png"
    input_full_path = os.path.join(folder, filename)
    
    # Save as specific name or overwrite? 
    # Let's save as a generic "stamps_source.png" so we can refer to it easily later.
    output_full_path = os.path.join(folder, "stamps_source_clean.png")
    
    if os.path.exists(input_full_path):
        remove_background(input_full_path, output_full_path)
    else:
        print(f"File not found: {input_full_path}")
