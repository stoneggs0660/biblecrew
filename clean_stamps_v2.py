
from PIL import Image
import os

def clean_image(file_path, x_margin=0, y_margin_top=0, y_margin_bottom=0):
    try:
        img = Image.open(file_path)
        img = img.convert("RGBA")
        width, height = img.size
        
        datas = img.getdata()
        newData = []
        
        for y in range(height):
            for x in range(width):
                index = y * width + x
                item = datas[index]
                
                # Check horizontal margins (Left/Right)
                is_horizontal_edge = (x < x_margin) or (x > width - x_margin)
                
                # Check vertical margins (Top/Bottom)
                is_vertical_edge = (y < y_margin_top) or (y > height - y_margin_bottom)
                
                if is_horizontal_edge or is_vertical_edge:
                    newData.append((255, 255, 255, 0)) # Make transparent
                else:
                    newData.append(item)
                    
        img.putdata(newData)
        img.save(file_path)
        print(f"Cleaned {file_path}: x_margin={x_margin}, top={y_margin_top}, bottom={y_margin_bottom}")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    # 2번: 좌우 잔여물 제거 (조금 더 과감하게 25px)
    clean_image("public/stamps/stamp_2.png", x_margin=25)
    
    # 4, 5, 6번: 위쪽 잔여물 제거 (20px 정도)
    # 5번은 아까 좌우도 했지만 혹시 모르니 좌우는 놔두고 위쪽만 추가 제거
    stamps_with_top_noise = ["public/stamps/stamp_4.png", "public/stamps/stamp_5.png", "public/stamps/stamp_6.png"]
    for path in stamps_with_top_noise:
        clean_image(path, y_margin_top=20)
