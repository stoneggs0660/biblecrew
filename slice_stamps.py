
import os
from PIL import Image

def slice_stamps(input_path, output_dir, grid_rows=3, grid_cols=3): # Changed to 3x3
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        img = Image.open(input_path)
        width, height = img.size
        
        cell_width = width // grid_cols
        cell_height = height // grid_rows
        
        count = 1
        for row in range(grid_rows):
            for col in range(grid_cols):
                # Calculate coordinates
                left = col * cell_width
                upper = row * cell_height
                right = left + cell_width
                lower = upper + cell_height
                
                # Crop
                cropped_img = img.crop((left, upper, right, lower))
                
                # Save
                output_filename = f"stamp_{count}.png"
                output_path = os.path.join(output_dir, output_filename)
                cropped_img.save(output_path)
                print(f"Saved {output_path}")
                count += 1

        print(f"Slice complete. {count-1} images saved to {output_dir}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    target_file = "public/stamps_sheet_v2_clean.png"
    output_folder = "public/stamps"
    
    slice_stamps(target_file, output_folder)
