
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
        # 배경 제거 로직:
        # 체크무늬 배경은 보통 흰색과 회색의 반복입니다.
        # 따라서 채도가 낮고(R,G,B 값이 비슷함) 명도가 높은(밝은) 픽셀을 투명하게 만듭니다.
        
        for item in datas:
            r, g, b, a = item
            
            # 채도 추정: RGB 값의 차이
            diff = max(r, g, b) - min(r, g, b)
            
            # 명도 추정: 평균 밝기
            brightness = (r + g + b) / 3

            # 조건 1: 완전 흰색에 가까운 경우 (250 이상)
            if r > 240 and g > 240 and b > 240:
                newData.append((255, 255, 255, 0))
            
            # 조건 2: 밝은 회색 (체크무늬의 회색 부분)
            # 회색은 RGB 값이 서로 비슷하며(diff가 작음), 밝기가 적당히 높음
            elif diff < 20 and brightness > 190:
                newData.append((255, 255, 255, 0))
                
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Successfully saved image to: {output_path}")
        return True

    except Exception as e:
        print(f"An error occurred: {e}")
        return False

if __name__ == "__main__":
    target_file = "public/stamps_sheet_v2.png"
    output_file = "public/stamps_sheet_v2_clean.png"
    
    if not os.path.exists(target_file):
        print(f"File not found: {target_file}")
    else:
        remove_background(target_file, output_file)
